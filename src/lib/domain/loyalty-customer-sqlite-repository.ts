import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ensurePrivateDir } from "../security/security";
import type { LoyaltyCustomerData, LoyaltyCustomerRepository } from "./loyalty-customer";

type CustomerRow = {
  application_id: string;
  account_id: string;
  ms_id: string;
  agent_bonus_balance: number;
  updated_at: string;
};

export class SqliteLoyaltyCustomerRepository implements LoyaltyCustomerRepository {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    ensurePrivateDir(path.dirname(filename));
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA busy_timeout=5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loyalty_customer (
        application_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        ms_id TEXT NOT NULL,
        agent_bonus_balance REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (application_id, account_id, ms_id)
      )
    `);
  }

  find(appId: string, accountId: string, msId: string): LoyaltyCustomerData | null {
    const row = this.db.prepare(`
      SELECT * FROM loyalty_customer
      WHERE application_id = ? AND account_id = ? AND ms_id = ?
    `).get(appId, accountId, msId) as CustomerRow | undefined;
    return row ? mapRow(row) : null;
  }

  save(data: LoyaltyCustomerData): void {
    const timestamp = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO loyalty_customer (
        application_id, account_id, ms_id, agent_bonus_balance, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (application_id, account_id, ms_id) DO UPDATE SET
        agent_bonus_balance = excluded.agent_bonus_balance,
        updated_at = excluded.updated_at
    `).run(
      data.appId,
      data.accountId,
      data.msId,
      data.agentBonusBalance,
      timestamp,
      timestamp
    );
  }
}

function mapRow(row: CustomerRow): LoyaltyCustomerData {
  return {
    appId: row.application_id,
    accountId: row.account_id,
    msId: row.ms_id,
    agentBonusBalance: Number(row.agent_bonus_balance),
    updatedAt: Date.parse(row.updated_at) || 0
  };
}
