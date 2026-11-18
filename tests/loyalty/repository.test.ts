// Интеграционный тест: HTTP-маршруты приложения или PostgreSQL.
import assert from "node:assert/strict";
import test from "node:test";
import { LoyaltyInstallation } from "../../src/loyalty/domain/loyalty-installation";
import { PostgresLoyaltyInstallationRepository } from "../../src/loyalty/domain/loyalty-installation-postgres-repository";
import { config } from "../../src/lib/config/config";
import { createTestDatabase } from "../db";

test("PostgreSQL хранит установку Loyalty API, шифрует токены и помнит признак подключения", async () => {
  const db = await createTestDatabase();

  try {
    const repository = new PostgresLoyaltyInstallationRepository(db.pool);
    LoyaltyInstallation.configureRepository(repository);
    const installation = new LoyaltyInstallation("app-1", "account-1");
    installation.beginUpdate(null, true);
    await installation.persist();
    const pendingToken = installation.pendingProviderToken ?? "";

    // Настройки отправлены, но не подтверждены: действующего токена еще нет, ожидающий уже находится.
    assert.equal((await repository.load("app-1", "account-1"))?.providerToken, null);
    assert.equal((await repository.load("app-1", "account-1"))?.pendingProviderToken, pendingToken);
    assert.equal((await repository.findByToken(pendingToken))?.accountId, "account-1");
    assert.equal((await repository.load("app-1", "account-1"))?.connectedAt, null);

    installation.confirmUpdate(installation.pendingSettings());
    await installation.persist();
    assert.equal((await repository.load("app-1", "account-1"))?.providerToken, pendingToken);
    assert.equal((await repository.load("app-1", "account-1"))?.pendingProviderToken, null);
    assert.equal((await repository.load("app-1", "account-1"))?.externalSearch, true);
    assert.notEqual((await repository.load("app-1", "account-1"))?.connectedAt, null);

    installation.markDisconnected();
    await installation.persist();
    assert.equal((await repository.load("app-1", "account-1"))?.connectedAt, null);
    assert.equal((await repository.load("app-1", "account-1"))?.providerToken, pendingToken);

    const row = (await db.pool.query<{ provider_token: string }>("SELECT provider_token FROM loyalty_installation")).rows[0]!;
    assert.notEqual(row.provider_token, pendingToken);
    assert.match(row.provider_token, /^enc:v1:/);

    await repository.delete("app-1", "account-1");
    assert.equal(await repository.load("app-1", "account-1"), null);
  } finally {
    await db.close();
  }
});

test("токены лояльности, зашифрованные другим APP_ENCRYPT_KEY, считаются отсутствующими", async () => {
  // Install и Uninstall читают подключение: после смены ключа оно не должно ронять их ошибкой расшифровки.
  const db = await createTestDatabase();
  const currentKey = config.encryptKey;

  try {
    const repository = new PostgresLoyaltyInstallationRepository(db.pool);
    config.encryptKey = "cd".repeat(32);
    await repository.save({
      appId: "app-1",
      accountId: "account-1",
      providerToken: "old",
      externalSearch: false,
      connectedAt: Date.now(),
      pendingProviderToken: "pending",
      pendingExternalSearch: false,
      updatedAt: 0
    });
    config.encryptKey = currentKey;

    const loaded = await repository.load("app-1", "account-1");
    assert.equal(loaded?.providerToken, null);
    assert.equal(loaded?.pendingProviderToken, null);
    assert.equal(await repository.findByToken("old"), null);
  } finally {
    config.encryptKey = currentKey;
    await db.close();
  }
});

test("параллельные подключения одного аккаунта оставляют один ожидающий токен", async () => {
  // Второй запрос должен увидеть ожидающий токен первого и получить отказ, а не затереть его своим.
  const db = await createTestDatabase();

  try {
    const repository = new PostgresLoyaltyInstallationRepository(db.pool);
    LoyaltyInstallation.configureRepository(repository);
    // Тест держит блокировку аккаунта, пока все запросы не встанут на нее, затем отпускает.
    const holder = await db.pool.connect();
    let blocked = 0;
    let pending: Promise<Awaited<ReturnType<typeof LoyaltyInstallation.beginLockedUpdate>>[]>;

    try {
      await holder.query("begin");
      await holder.query("select pg_advisory_xact_lock(hashtext('loyalty:app-1:account-1'))");
      pending = Promise.all(
        ["token-a", "token-b", "token-c"].map((token) => LoyaltyInstallation.beginLockedUpdate("app-1", "account-1", token, false))
      );
      const deadline = Date.now() + 10_000;

      while (blocked < 3 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const result = await holder.query(
          "select count(*)::int as blocked from pg_locks where locktype = 'advisory' and not granted" +
            " and database = (select oid from pg_database where datname = current_database())"
        );
        blocked = result.rows[0].blocked;
      }
    } finally {
      await holder.query("rollback");
      holder.release();
    }

    const attempts = await pending;
    assert.equal(blocked, 3);
    const started = attempts.filter((attempt) => attempt !== null);

    assert.equal(started.length, 1);
    assert.equal((await repository.load("app-1", "account-1"))?.pendingProviderToken, started[0]?.installation.pendingProviderToken);
  } finally {
    await db.close();
  }
});
