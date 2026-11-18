// Тестовая база: PostgreSQL из docker-compose.yml (`docker compose up -d postgres`), другой сервер задается APP_DB_*.
// Каждый вызов создает свою схему и удаляет ее в close().
import crypto from "node:crypto";
import type { Pool } from "pg";
import { config } from "../src/lib/config/config";
import { applyMigrations } from "../src/lib/db/migrations";
import { createPool } from "../src/lib/db/pool";

config.encryptKey = "ab".repeat(32);

export type TestDatabase = {
  pool: Pool;
  schema: string;
  close(): Promise<void>;
};

export async function createTestDatabase(): Promise<TestDatabase> {
  const schema = `test_${crypto.randomBytes(4).toString("hex")}`;
  const pool = createPool({
    ...config,
    dbHost: config.dbHost || "localhost",
    dbName: config.dbName || "node_js_demo_app",
    dbUser: config.dbUser || "node_js_demo_app",
    dbPassword: config.dbPassword || "node_js_demo_app",
    dbSchema: schema
  });
  await applyMigrations(pool, schema);

  return {
    pool,
    schema,
    async close() {
      await pool.query(`drop schema if exists ${schema} cascade`);
      await pool.end();
    }
  };
}
