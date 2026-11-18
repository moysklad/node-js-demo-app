import crypto from "node:crypto";
import type { Pool } from "pg";
import { decryptSensitiveOrNull, encryptSensitive } from "../../lib/security/security";
import type { LoyaltyInstallationData, LoyaltyInstallationRepository } from "./loyalty-installation";

type InstallationRow = {
  application_id: string;
  account_id: string;
  provider_token: string | null;
  external_search: number;
  connected_at: string | null;
  pending_provider_token: string | null;
  pending_external_search: number;
  updated_at: string;
};

export class PostgresLoyaltyInstallationRepository implements LoyaltyInstallationRepository {
  constructor(private readonly pool: Pool) {}

  async load(appId: string, accountId: string): Promise<LoyaltyInstallationData | null> {
    const { rows } = await this.pool.query<InstallationRow>(
      "SELECT * FROM loyalty_installation WHERE application_id = $1 AND account_id = $2",
      [appId, accountId]
    );
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  // Токены хранятся зашифрованными, поэтому по значению их не найти запросом: сверяем после расшифровки.
  async findByToken(token: string): Promise<LoyaltyInstallationData | null> {
    const candidate = Buffer.from(token);
    const { rows } = await this.pool.query<InstallationRow>("SELECT * FROM loyalty_installation");
    for (const row of rows) {
      const data = mapRow(row);
      for (const stored of [data.providerToken, data.pendingProviderToken]) {
        if (stored === null) {
          continue;
        }

        const storedBuffer = Buffer.from(stored);
        if (storedBuffer.length === candidate.length && crypto.timingSafeEqual(storedBuffer, candidate)) {
          return data;
        }
      }
    }
    return null;
  }

  async updateLocked(
    appId: string,
    accountId: string,
    change: (data: LoyaltyInstallationData | null) => LoyaltyInstallationData | null
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`loyalty:${appId}:${accountId}`]);
      const { rows } = await client.query<InstallationRow>(
        "SELECT * FROM loyalty_installation WHERE application_id = $1 AND account_id = $2",
        [appId, accountId]
      );
      const changed = change(rows[0] ? mapRow(rows[0]) : null);

      if (changed) {
        await client.query(UPSERT_SQL, upsertParams(changed));
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async save(data: LoyaltyInstallationData): Promise<void> {
    await this.pool.query(UPSERT_SQL, upsertParams(data));
  }

  async delete(appId: string, accountId: string): Promise<void> {
    await this.pool.query("DELETE FROM loyalty_installation WHERE application_id = $1 AND account_id = $2", [appId, accountId]);
  }
}

const UPSERT_SQL = `
  INSERT INTO loyalty_installation (
    application_id, account_id, provider_token, external_search, connected_at,
    pending_provider_token, pending_external_search, created_at, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
  ON CONFLICT (application_id, account_id) DO UPDATE SET
    provider_token = excluded.provider_token,
    external_search = excluded.external_search,
    connected_at = excluded.connected_at,
    pending_provider_token = excluded.pending_provider_token,
    pending_external_search = excluded.pending_external_search,
    updated_at = excluded.updated_at
`;

function upsertParams(data: LoyaltyInstallationData): unknown[] {
  return [
    data.appId,
    data.accountId,
    encryptToken(data.providerToken),
    data.externalSearch ? 1 : 0,
    data.connectedAt === null ? null : new Date(data.connectedAt).toISOString(),
    encryptToken(data.pendingProviderToken),
    data.pendingExternalSearch ? 1 : 0,
    new Date().toISOString()
  ];
}

function encryptToken(token: string | null): string | null {
  return token === null ? null : encryptSensitive(token);
}

function decryptToken(token: string | null): string | null {
  return token === null ? null : decryptSensitiveOrNull(token, "Loyalty token");
}

function mapRow(row: InstallationRow): LoyaltyInstallationData {
  return {
    appId: row.application_id,
    accountId: row.account_id,
    providerToken: decryptToken(row.provider_token),
    externalSearch: Boolean(row.external_search),
    connectedAt: row.connected_at ? Date.parse(row.connected_at) || null : null,
    pendingProviderToken: decryptToken(row.pending_provider_token),
    pendingExternalSearch: Boolean(row.pending_external_search),
    updatedAt: Date.parse(row.updated_at) || 0
  };
}
