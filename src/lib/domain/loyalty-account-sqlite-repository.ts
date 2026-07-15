import crypto from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decryptSensitive, encryptSensitive, ensurePrivateDir } from "../security/security";
import type { LoyaltyAccountData, LoyaltyAccountRepository } from "./loyalty-account";

type LoyaltyAccountRow = {
  application_id: string;
  account_id: string;
  login: string;
  password_hash: string;
  token: string;
  updated_at: string;
};

export class SqliteLoyaltyAccountRepository implements LoyaltyAccountRepository {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    ensurePrivateDir(path.dirname(filename));
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA busy_timeout=5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loyalty_account (
        account_id TEXT NOT NULL,
        application_id TEXT NOT NULL,
        login TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, application_id)
      )
    `);
  }

  load(appId: string, accountId: string): LoyaltyAccountData | null {
    const row = this.db
      .prepare("SELECT * FROM loyalty_account WHERE application_id = ? AND account_id = ?")
      .get(appId, accountId) as LoyaltyAccountRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByLogin(login: string): LoyaltyAccountData | null {
    const row = this.db
      .prepare("SELECT * FROM loyalty_account WHERE login = ?")
      .get(login) as LoyaltyAccountRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByToken(token: string): LoyaltyAccountData | null {
    const rows = this.db.prepare("SELECT * FROM loyalty_account").all() as LoyaltyAccountRow[];
    const normalized = Buffer.from(token);
    for (const row of rows) {
      const stored = Buffer.from(this.mapRow(row).token);
      if (stored.length === normalized.length && crypto.timingSafeEqual(stored, normalized)) {
        return this.mapRow(row);
      }
    }
    return null;
  }

  save(data: LoyaltyAccountData): void {
    const timestamp = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO loyalty_account (
          account_id, application_id, login, password_hash, token, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (account_id, application_id) DO UPDATE SET
          login = excluded.login,
          password_hash = excluded.password_hash,
          token = excluded.token,
          updated_at = excluded.updated_at
      `)
      .run(
        data.accountId,
        data.appId,
        data.login,
        data.passwordHash,
        encryptSensitive(data.token),
        timestamp,
        timestamp
      );
  }

  delete(appId: string, accountId: string): void {
    this.db.prepare("DELETE FROM loyalty_account WHERE application_id = ? AND account_id = ?").run(appId, accountId);
  }

  private mapRow(row: LoyaltyAccountRow): LoyaltyAccountData {
    return {
      appId: row.application_id,
      accountId: row.account_id,
      login: row.login,
      passwordHash: row.password_hash,
      token: decryptSensitive(row.token),
      updatedAt: Date.parse(row.updated_at) || 0
    };
  }
}
