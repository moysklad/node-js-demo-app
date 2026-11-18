import { setTimeout as sleep } from "node:timers/promises";
import { Pool, types } from "pg";
import type { AppConfig } from "../config/config";
import { logMessage } from "../observability/logger";

const POOL_SIZE = 5;
const CONNECTION_TIMEOUT_MS = 5_000;
// сколько ждать базу на старте: в docker compose PostgreSQL стартует одновременно с приложением
const STARTUP_CONNECT_ATTEMPTS = 30;
const STARTUP_CONNECT_RETRY_MS = 1_000;

// bigint-колонки (expires_at, id журнала) читаем числами, а не строками.
types.setTypeParser(types.builtins.INT8, Number);

export function createPool(config: AppConfig): Pool {
  const pool = new Pool({
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    max: POOL_SIZE,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    options: `-c search_path=${config.dbSchema},public`
  });

  pool.on("error", (error) => {
    logMessage("ERROR", "PostgreSQL connection error", { error: error.message });
  });

  return pool;
}

export async function waitForDatabase(pool: Pool): Promise<void> {
  for (let attempt = 1; attempt < STARTUP_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logMessage("WARN", `Database is not ready (attempt ${attempt}/${STARTUP_CONNECT_ATTEMPTS}): ${message}`);
      await sleep(STARTUP_CONNECT_RETRY_MS);
    }
  }

  await pool.query("select 1");
}
