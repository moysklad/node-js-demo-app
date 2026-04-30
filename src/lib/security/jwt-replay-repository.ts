import path from "node:path";
import Database from "better-sqlite3";
import { ensurePrivateDir } from "./security";

export interface JwtReplayRepository {
  register(jti: string, expUnixSeconds: number): boolean;
}

const PRUNE_INTERVAL_MS = 60_000;
const PRUNE_MAX_ROWS_PER_RUN = 500;

let repository: JwtReplayRepository | null = null;

export function configureJwtReplayRepository(nextRepository: JwtReplayRepository): void {
  repository = nextRepository;
}

export function registerJwtJti(jti: string, expUnixSeconds: number): boolean {
  if (!repository) {
    throw new Error("JWT replay repository is not configured");
  }

  return repository.register(jti, expUnixSeconds);
}

export class SqliteJwtReplayRepository implements JwtReplayRepository {
  private readonly db: Database.Database;
  private lastPruneAt = 0;

  constructor(filename: string) {
    ensurePrivateDir(path.dirname(filename));
    this.db = new Database(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jwt (
        jti TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (jti)
      )
    `);
  }

  register(jti: string, expUnixSeconds: number): boolean {
    this.maybePruneExpiredJti();

    const result = this.db
      .prepare("INSERT OR IGNORE INTO jwt (jti, expires_at) VALUES (?, ?)")
      .run(jti, expUnixSeconds * 1000);

    return result.changes === 1;
  }

  private maybePruneExpiredJti(): void {
    const now = Date.now();

    if (now - this.lastPruneAt < PRUNE_INTERVAL_MS) {
      return;
    }

    this.lastPruneAt = now;
    this.db
      .prepare("DELETE FROM jwt WHERE jti IN (SELECT jti FROM jwt WHERE expires_at <= ? LIMIT ?)")
      .run(now, PRUNE_MAX_ROWS_PER_RUN);
  }
}
