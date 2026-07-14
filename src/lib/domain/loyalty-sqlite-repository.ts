import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decryptSensitive, encryptSensitive, ensurePrivateDir } from "../security/security";
import type { LoyaltyRepository, LoyaltySettingsData } from "./loyalty";

type LoyaltyRow = {
  application_id: string;
  account_id: string;
  loyalty_provider_url: string | null;
  loyalty_encrypted_key: string | null;
  loyalty_external_customers: number | null;
  updated_at: string | null;
};

export class SqliteLoyaltyRepository implements LoyaltyRepository {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    ensurePrivateDir(path.dirname(filename));
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA busy_timeout=5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS account_loyalty_program (
        account_id TEXT NOT NULL,
        application_id TEXT NOT NULL,
        loyalty_provider_url TEXT,
        loyalty_encrypted_key TEXT,
        loyalty_external_customers INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, application_id)
      )
    `);
  }

  load(appId: string, accountId: string): LoyaltySettingsData | null {
    const row = this.db
      .prepare(
        `
          SELECT application_id, account_id, loyalty_provider_url, loyalty_encrypted_key,
                 loyalty_external_customers, updated_at
          FROM account_loyalty_program
          WHERE application_id = ? AND account_id = ?
          LIMIT 1
        `
      )
      .get(appId, accountId) as LoyaltyRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  save(data: LoyaltySettingsData): void {
    const timestamp = new Date().toISOString();
    const providerUrl = normalizeNullableString(data.loyaltyProviderUrl);
    const encryptedKey = normalizeNullableString(data.loyaltyEncryptedKey);

    this.db
      .prepare(
        `
          INSERT INTO account_loyalty_program (
            account_id, application_id, loyalty_provider_url, loyalty_encrypted_key,
            loyalty_external_customers, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (account_id, application_id) DO UPDATE SET
            loyalty_provider_url = excluded.loyalty_provider_url,
            loyalty_encrypted_key = excluded.loyalty_encrypted_key,
            loyalty_external_customers = excluded.loyalty_external_customers,
            updated_at = excluded.updated_at
        `
      )
      .run(
        data.accountId,
        data.appId,
        providerUrl,
        encryptedKey ? encryptSensitive(encryptedKey) : null,
        data.loyaltyExternalCustomers ? 1 : 0,
        timestamp,
        timestamp
      );
  }

  delete(appId: string, accountId: string): void {
    this.db
      .prepare("DELETE FROM account_loyalty_program WHERE application_id = ? AND account_id = ?")
      .run(appId, accountId);
  }

  private mapRow(row: LoyaltyRow): LoyaltySettingsData {
    return {
      appId: row.application_id,
      accountId: row.account_id,
      loyaltyProviderUrl: row.loyalty_provider_url ?? "",
      loyaltyEncryptedKey: row.loyalty_encrypted_key ? decryptSensitive(row.loyalty_encrypted_key) : "",
      loyaltyExternalCustomers: Boolean(row.loyalty_external_customers),
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : 0
    };
  }
}

function normalizeNullableString(value: string): string | null {
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}
