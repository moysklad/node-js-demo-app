import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decryptSensitive, encryptSensitive, ensurePrivateDir } from "../security/security";
import { AppStatus, type AppInstanceData, type AppInstanceRepository } from "./app-instance";

type AppInstanceRow = {
  application_id: string;
  account_id: string;
  info_message: string | null;
  store: string | null;
  access_token: string | null;
  status: number;
  updated_at: string | null;
};

export class SqliteAppInstanceRepository implements AppInstanceRepository {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    ensurePrivateDir(path.dirname(filename));
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS account_application (
        account_id TEXT NOT NULL,
        application_id TEXT NOT NULL,
        status INTEGER,
        access_token TEXT,
        info_message TEXT,
        store TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, application_id)
      )
    `);
  }

  load(appId: string, accountId: string): AppInstanceData | null {
    const row = this.db
      .prepare(
        `
          SELECT application_id, account_id, info_message, store, access_token, status, updated_at
          FROM account_application
          WHERE application_id = ? AND account_id = ?
          LIMIT 1
        `
      )
      .get(appId, accountId) as AppInstanceRow | undefined;

    if (!row) {
      return null;
    }

    return {
      appId: row.application_id,
      accountId: row.account_id,
      infoMessage: row.info_message ?? "",
      store: row.store ?? "",
      accessToken: row.access_token ? decryptSensitive(row.access_token) : "",
      status: row.status as AppStatus,
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : 0,
    };
  }

  save(data: AppInstanceData): void {
    const timestamp = new Date().toISOString();
    const infoMessage = normalizeNullableString(data.infoMessage);
    const store = normalizeNullableString(data.store);
    const accessToken = normalizeNullableString(data.accessToken);

    this.db
      .prepare(
        `
          INSERT INTO account_application (
            account_id, application_id, status, access_token, info_message, store, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (account_id, application_id) DO UPDATE SET
            status = excluded.status,
            access_token = excluded.access_token,
            info_message = excluded.info_message,
            store = excluded.store,
            updated_at = excluded.updated_at
        `
      )
      .run(
        data.accountId,
        data.appId,
        data.status,
        accessToken ? encryptSensitive(accessToken) : null,
        infoMessage,
        store,
        timestamp,
        timestamp
      );
  }

  delete(appId: string, accountId: string): void {
    this.db
      .prepare("DELETE FROM account_application WHERE application_id = ? AND account_id = ?")
      .run(appId, accountId);
  }
}

function normalizeNullableString(value: string): string | null {
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}
