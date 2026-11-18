import type { Pool } from "pg";
import { decryptSensitiveOrNull, encryptSensitive } from "../security/security";
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

export class PostgresAppInstanceRepository implements AppInstanceRepository {
  constructor(private readonly pool: Pool) {}

  async load(appId: string, accountId: string): Promise<AppInstanceData | null> {
    const { rows } = await this.pool.query<AppInstanceRow>(
      `
        SELECT application_id, account_id, info_message, store, access_token, status, updated_at
        FROM account_application
        WHERE application_id = $1 AND account_id = $2
      `,
      [appId, accountId]
    );
    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      appId: row.application_id,
      accountId: row.account_id,
      infoMessage: row.info_message ?? "",
      store: row.store ?? "",
      accessToken: row.access_token ? decryptSensitiveOrNull(row.access_token, "Access token") ?? "" : "",
      status: row.status as AppStatus,
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : 0
    };
  }

  async save(data: AppInstanceData): Promise<void> {
    const timestamp = new Date().toISOString();
    const infoMessage = normalizeNullableString(data.infoMessage);
    const store = normalizeNullableString(data.store);
    const accessToken = normalizeNullableString(data.accessToken);

    await this.pool.query(
      `
        INSERT INTO account_application (
          account_id, application_id, status, access_token, info_message, store, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (account_id, application_id) DO UPDATE SET
          status = excluded.status,
          access_token = CASE WHEN $8::boolean THEN account_application.access_token ELSE excluded.access_token END,
          info_message = excluded.info_message,
          store = excluded.store,
          updated_at = excluded.updated_at
      `,
      [
        data.accountId,
        data.appId,
        data.status,
        accessToken ? encryptSensitive(accessToken) : null,
        infoMessage,
        store,
        timestamp,
        !accessToken && (await this.hasUnreadableAccessToken(data.appId, data.accountId))
      ]
    );
  }

  // Токен, зашифрованный другим APP_ENCRYPT_KEY, читается как отсутствующий. Сохранение без нового токена
  // не должно затирать его шифротекст: ключ могли подменить по ошибке, после возврата токен снова прочитается.
  private async hasUnreadableAccessToken(appId: string, accountId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ access_token: string | null }>(
      "SELECT access_token FROM account_application WHERE application_id = $1 AND account_id = $2",
      [appId, accountId]
    );
    const stored = rows[0]?.access_token;

    return Boolean(stored) && decryptSensitiveOrNull(stored as string, "Access token") === null;
  }

  async delete(appId: string, accountId: string): Promise<void> {
    await this.pool.query("DELETE FROM account_application WHERE application_id = $1 AND account_id = $2", [appId, accountId]);
  }
}

function normalizeNullableString(value: string): string | null {
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}
