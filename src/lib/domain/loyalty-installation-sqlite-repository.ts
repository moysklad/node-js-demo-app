import crypto from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decryptSensitive, encryptSensitive, ensurePrivateDir } from "../security/security";
import type { LoyaltyInstallationData, LoyaltyInstallationRepository } from "./loyalty-installation";

type InstallationRow = {
  application_id: string;
  account_id: string;
  provider_token: string;
  external_search: number;
  connected_at: string | null;
  updated_at: string;
};

export class SqliteLoyaltyInstallationRepository implements LoyaltyInstallationRepository {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    ensurePrivateDir(path.dirname(filename));
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA busy_timeout=5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loyalty_installation (
        application_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        provider_token TEXT NOT NULL,
        external_search INTEGER NOT NULL DEFAULT 0,
        connected_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (application_id, account_id)
      )
    `);
  }

  load(appId: string, accountId: string): LoyaltyInstallationData | null {
    const row = this.db.prepare(`
      SELECT * FROM loyalty_installation WHERE application_id = ? AND account_id = ?
    `).get(appId, accountId) as InstallationRow | undefined;
    return row ? mapRow(row) : null;
  }

  findByToken(token: string): LoyaltyInstallationData | null {
    const candidate = Buffer.from(token);
    const rows = this.db.prepare("SELECT * FROM loyalty_installation").all() as InstallationRow[];
    for (const row of rows) {
      const data = mapRow(row);
      const stored = Buffer.from(data.providerToken);
      if (stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate)) {
        return data;
      }
    }
    return null;
  }

  save(data: LoyaltyInstallationData): void {
    const timestamp = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO loyalty_installation (
        application_id, account_id, provider_token, external_search, connected_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (application_id, account_id) DO UPDATE SET
        provider_token = excluded.provider_token,
        external_search = excluded.external_search,
        connected_at = excluded.connected_at,
        updated_at = excluded.updated_at
    `).run(
      data.appId,
      data.accountId,
      encryptSensitive(data.providerToken),
      data.externalSearch ? 1 : 0,
      data.connectedAt === null ? null : new Date(data.connectedAt).toISOString(),
      timestamp,
      timestamp
    );
  }

  delete(appId: string, accountId: string): void {
    this.db.prepare("DELETE FROM loyalty_installation WHERE application_id = ? AND account_id = ?")
      .run(appId, accountId);
  }
}

function mapRow(row: InstallationRow): LoyaltyInstallationData {
  return {
    appId: row.application_id,
    accountId: row.account_id,
    providerToken: decryptSensitive(row.provider_token),
    externalSearch: Boolean(row.external_search),
    connectedAt: row.connected_at ? Date.parse(row.connected_at) || null : null,
    updatedAt: Date.parse(row.updated_at) || 0
  };
}
