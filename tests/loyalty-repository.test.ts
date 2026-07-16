import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { config } from "../src/lib/config/config";
import { LoyaltyInstallation } from "../src/lib/domain/loyalty-installation";
import { SqliteLoyaltyInstallationRepository } from "../src/lib/domain/loyalty-installation-sqlite-repository";

test("SQLite stores one LoyaltyAPI installation and encrypts its token", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "loyalty-installation-test-"));
  const databasePath = path.join(directory, "app.sqlite");
  const originalEncryptKey = config.encryptKey;
  config.encryptKey = "ab".repeat(32);

  try {
    const repository = new SqliteLoyaltyInstallationRepository(databasePath);
    LoyaltyInstallation.configureRepository(repository);
    const installation = LoyaltyInstallation.create("app-1", "account-1");
    installation.persist();

    assert.equal(repository.load("app-1", "account-1")?.providerToken, installation.providerToken);
    assert.equal(repository.findByToken(installation.providerToken)?.accountId, "account-1");

    const database = new DatabaseSync(databasePath);
    const row = database.prepare("SELECT provider_token FROM loyalty_installation").get() as {
      provider_token: string;
    };
    assert.notEqual(row.provider_token, installation.providerToken);
    assert.match(row.provider_token, /^enc:v1:/);
    database.close();

    repository.delete("app-1", "account-1");
    assert.equal(repository.load("app-1", "account-1"), null);
  } finally {
    config.encryptKey = originalEncryptKey;
    rmSync(directory, { recursive: true, force: true });
  }
});
