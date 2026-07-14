import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { config } from "../src/lib/config/config";
import { SqliteLoyaltyRepository } from "../src/lib/domain/loyalty-sqlite-repository";

test("SQLite stores loyalty settings and encrypts token at rest", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "loyalty-test-"));
  const databasePath = path.join(directory, "app.sqlite");
  const originalEncryptKey = config.encryptKey;
  config.encryptKey = "ab".repeat(32);

  try {
    const repository = new SqliteLoyaltyRepository(databasePath);
    repository.save({
      appId: "app-1",
      accountId: "account-1",
      loyaltyProviderUrl: "https://demo.example/loyalty",
      loyaltyEncryptedKey: "provider-token",
      loyaltyExternalCustomers: true,
      updatedAt: Date.now()
    });

    const loaded = repository.load("app-1", "account-1");
    assert.deepEqual(loaded && { ...loaded, updatedAt: 0 }, {
      appId: "app-1",
      accountId: "account-1",
      loyaltyProviderUrl: "https://demo.example/loyalty",
      loyaltyEncryptedKey: "provider-token",
      loyaltyExternalCustomers: true,
      updatedAt: 0
    });
    assert.equal(typeof loaded?.updatedAt, "number");
    const database = new DatabaseSync(databasePath);
    const row = database
      .prepare("SELECT loyalty_encrypted_key FROM account_loyalty_program WHERE application_id = ? AND account_id = ?")
      .get("app-1", "account-1") as { loyalty_encrypted_key: string };
    assert.notEqual(row.loyalty_encrypted_key, "provider-token");
    assert.match(row.loyalty_encrypted_key, /^enc:v1:/);
    database.close();

    repository.delete("app-1", "account-1");
    assert.equal(repository.load("app-1", "account-1"), null);
  } finally {
    config.encryptKey = originalEncryptKey;
    rmSync(directory, { recursive: true, force: true });
  }
});
