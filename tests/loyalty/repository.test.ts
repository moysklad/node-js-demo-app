// Интеграционный тест: HTTP-маршруты приложения или SQLite.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { config } from "../../src/lib/config/config";
import { LoyaltyInstallation } from "../../src/loyalty/domain/loyalty-installation";
import { SqliteLoyaltyInstallationRepository } from "../../src/loyalty/domain/loyalty-installation-sqlite-repository";

test("SQLite хранит установку Loyalty API, шифрует токены и помнит признак подключения", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "loyalty-installation-test-"));
  const databasePath = path.join(directory, "app.sqlite");
  const originalEncryptKey = config.encryptKey;
  config.encryptKey = "ab".repeat(32);

  try {
    const repository = new SqliteLoyaltyInstallationRepository(databasePath);
    LoyaltyInstallation.configureRepository(repository);
    const installation = new LoyaltyInstallation("app-1", "account-1");
    installation.beginUpdate(null, true);
    installation.persist();
    const pendingToken = installation.pendingProviderToken ?? "";

    // Настройки отправлены, но не подтверждены: действующего токена еще нет, ожидающий уже находится.
    assert.equal(repository.load("app-1", "account-1")?.providerToken, null);
    assert.equal(repository.load("app-1", "account-1")?.pendingProviderToken, pendingToken);
    assert.equal(repository.findByToken(pendingToken)?.accountId, "account-1");
    assert.equal(repository.load("app-1", "account-1")?.connectedAt, null);

    installation.confirmUpdate();
    installation.persist();
    assert.equal(repository.load("app-1", "account-1")?.providerToken, pendingToken);
    assert.equal(repository.load("app-1", "account-1")?.pendingProviderToken, null);
    assert.equal(repository.load("app-1", "account-1")?.externalSearch, true);
    assert.notEqual(repository.load("app-1", "account-1")?.connectedAt, null);

    installation.markDisconnected();
    installation.persist();
    assert.equal(repository.load("app-1", "account-1")?.connectedAt, null);
    assert.equal(repository.load("app-1", "account-1")?.providerToken, pendingToken);

    const database = new DatabaseSync(databasePath);
    const row = database.prepare("SELECT provider_token FROM loyalty_installation").get() as {
      provider_token: string;
    };
    assert.notEqual(row.provider_token, pendingToken);
    assert.match(row.provider_token, /^enc:v1:/);
    database.close();

    repository.delete("app-1", "account-1");
    assert.equal(repository.load("app-1", "account-1"), null);
  } finally {
    config.encryptKey = originalEncryptKey;
    rmSync(directory, { recursive: true, force: true });
  }
});
