// Интеграционный тест: PostgreSQL-хранилища установок и replay-маркеров JWT, миграции схемы.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { applyMigrations, migrationVersions } from "../../src/lib/db/migrations";
import { AppStatus } from "../../src/lib/domain/app-instance";
import { PostgresAppInstanceRepository } from "../../src/lib/domain/app-instance-postgres-repository";
import { config } from "../../src/lib/config/config";
import { PostgresJwtReplayRepository } from "../../src/lib/security/jwt-replay-repository";
import { PostgresSessionStore } from "../../src/lib/session/postgres-session-store";
import { createTestDatabase, type TestDatabase } from "../db";

let db: TestDatabase;

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db.close();
});

test("миграции применяются один раз и повторный запуск ничего не меняет", async () => {
  assert.deepEqual(await applyMigrations(db.pool, db.schema), []);

  const versions = (await db.pool.query<{ version: string }>("select version from schema_migrations")).rows.map((row) => row.version);
  const tables = (
    await db.pool.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = $1", [db.schema])
  ).rows.map((row) => row.table_name);

  assert.deepEqual(versions.sort(), migrationVersions());
  assert.ok(["schema_migrations", "account_application", "sessions", "jwt"].every((table) => tables.includes(table)));
});

test("хранилище установок сохраняет, читает и удаляет запись, токен лежит зашифрованным", async () => {
  const repository = new PostgresAppInstanceRepository(db.pool);

  await repository.save({
    appId: "app-1",
    accountId: "account-1",
    infoMessage: "settings",
    store: "main",
    accessToken: "token",
    status: AppStatus.SETTINGS_REQUIRED,
    updatedAt: 0
  });
  const loaded = await repository.load("app-1", "account-1");

  assert.equal(loaded?.accessToken, "token");
  assert.equal(loaded?.status, AppStatus.SETTINGS_REQUIRED);
  assert.ok((loaded?.updatedAt ?? 0) > 0);
  const row = (await db.pool.query<{ access_token: string }>("select access_token from account_application")).rows[0];
  assert.match(row?.access_token ?? "", /^enc:v1:/);

  await repository.delete("app-1", "account-1");
  assert.equal(await repository.load("app-1", "account-1"), null);
});

test("зарезервированное слово подходит как имя схемы", async () => {
  // APP_NAME=order дает схему order: имя должно попадать в SQL как идентификатор в кавычках.
  try {
    await applyMigrations(db.pool, "order");
  } finally {
    await db.pool.query('drop schema if exists "order" cascade');
  }
});

test("токен и сессия, зашифрованные другим APP_ENCRYPT_KEY, считаются отсутствующими", async () => {
  // После смены APP_ENCRYPT_KEY решение должно дожить до переустановки, а не отвечать 500.
  const repository = new PostgresAppInstanceRepository(db.pool);
  const store = new PostgresSessionStore(db.pool);
  const currentKey = config.encryptKey;
  config.encryptKey = "cd".repeat(32);

  try {
    await repository.save({
      appId: "app-2",
      accountId: "account-2",
      infoMessage: "",
      store: "",
      accessToken: "token",
      status: AppStatus.ACTIVATED,
      updatedAt: 0
    });
    await new Promise<void>((resolve, reject) =>
      store.set("sid-other-key", { cookie: { expires: new Date(Date.now() + 60_000) } } as never, (error) => (error ? reject(error) : resolve()))
    );
  } finally {
    config.encryptKey = currentKey;
  }

  assert.equal((await repository.load("app-2", "account-2"))?.accessToken, "");
  const session = await new Promise((resolve, reject) =>
    store.get("sid-other-key", (error, data) => (error ? reject(error) : resolve(data)))
  );
  assert.equal(session, null);
});

test("сохранение при другом APP_ENCRYPT_KEY не затирает нечитаемый токен", async () => {
  // Ключ подменили по ошибке: сохранение настроек не должно затереть токен, после возврата ключа он снова читается.
  const repository = new PostgresAppInstanceRepository(db.pool);
  const currentKey = config.encryptKey;
  const data = { appId: "app-3", accountId: "account-3", infoMessage: "", store: "", accessToken: "token", status: AppStatus.ACTIVATED, updatedAt: 0 };
  await repository.save(data);
  config.encryptKey = "cd".repeat(32);

  try {
    const loaded = await repository.load("app-3", "account-3");
    assert.equal(loaded?.accessToken, "");
    await repository.save({ ...data, accessToken: "", infoMessage: "changed" });
  } finally {
    config.encryptKey = currentKey;
  }

  const restored = await repository.load("app-3", "account-3");
  assert.equal(restored?.accessToken, "token");
  assert.equal(restored?.infoMessage, "changed");

  await repository.save({ ...data, accessToken: "" });
  assert.equal((await repository.load("app-3", "account-3"))?.accessToken, "");
});

test("replay-защита принимает jti один раз", async () => {
  // Первый jti принимается, повтор того же jti отклоняется как replay.
  const repository = new PostgresJwtReplayRepository(db.pool);
  const expiresAt = Math.floor(Date.now() / 1000) + 300;

  assert.equal(await repository.register("jti-1", expiresAt), true);
  assert.equal(await repository.register("jti-1", expiresAt), false);
  assert.equal(await repository.register("jti-2", expiresAt), true);
});
