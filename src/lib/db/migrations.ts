import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import { logMessage } from "../observability/logger";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

/**
 * Создает схему решения и применяет SQL-файлы из migrations/ по порядку имен.
 * Под advisory lock, чтобы параллельно стартующие экземпляры не мешали друг другу.
 */
export async function applyMigrations(pool: Pool, schema: string): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [schema]);
    await client.query(`create schema if not exists "${schema}"`);
    await client.query(
      "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())"
    );
    const known = new Set(
      (await client.query<{ version: string }>("select version from schema_migrations")).rows.map((row) => row.version)
    );

    for (const version of migrationVersions()) {
      if (known.has(version)) {
        continue;
      }

      await client.query(readFileSync(path.join(MIGRATIONS_DIR, `${version}.sql`), "utf-8"));
      await client.query("insert into schema_migrations (version) values ($1)", [version]);
      applied.push(version);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  if (applied.length > 0) {
    logMessage("INFO", `Applied database migrations in schema ${schema}: ${applied.join(", ")}`);
  }

  return applied;
}

export function migrationVersions(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => path.basename(name, ".sql"))
    .sort();
}
