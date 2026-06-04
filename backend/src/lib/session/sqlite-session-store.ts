import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import session from "express-session";
import { decryptSensitive, encryptSensitive, ensurePrivateDir } from "../security/security";

type SessionRow = {
  session_json: string;
  expires_at: number;
};

const PRUNE_INTERVAL_MS = 60_000;
const PRUNE_MAX_ROWS_PER_RUN = 500;
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export class SqliteSessionStore extends session.Store {
  private readonly db: DatabaseSync;
  private lastPruneAt = 0;

  constructor(filename: string) {
    super();
    ensurePrivateDir(path.dirname(filename));
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        session_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  override get(sid: string, callback: (err?: unknown, sessionData?: session.SessionData | null) => void): void {
    try {
      const row = this.db
        .prepare("SELECT session_json, expires_at FROM sessions WHERE sid = ? LIMIT 1")
        .get(sid) as SessionRow | undefined;

      if (!row) {
        callback(undefined, null);
        return;
      }

      if (row.expires_at <= Date.now()) {
        this.db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
        callback(undefined, null);
        return;
      }

      callback(undefined, JSON.parse(decryptSensitive(row.session_json)) as session.SessionData);
    } catch (error) {
      callback(error, null);
    }
  }

  override set(sid: string, sessionData: session.SessionData, callback?: (err?: unknown) => void): void {
    try {
      this.maybePruneExpiredSessions();
      this.db
        .prepare(
          `
            INSERT INTO sessions (sid, session_json, expires_at)
            VALUES (?, ?, ?)
            ON CONFLICT (sid) DO UPDATE SET
              session_json = excluded.session_json,
              expires_at = excluded.expires_at
          `
        )
        .run(sid, encryptSensitive(JSON.stringify(sessionData)), this.resolveExpiresAt(sessionData));
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override touch(sid: string, sessionData: session.SessionData, callback?: (err?: unknown) => void): void {
    this.set(sid, sessionData, callback);
  }

  private resolveExpiresAt(sessionData: session.SessionData): number {
    const expires = sessionData.cookie?.expires;

    if (expires instanceof Date) {
      return expires.getTime();
    }

    return Date.now() + DEFAULT_SESSION_TTL_MS;
  }

  private maybePruneExpiredSessions(): void {
    const now = Date.now();

    if (now - this.lastPruneAt < PRUNE_INTERVAL_MS) {
      return;
    }

    this.lastPruneAt = now;
    this.db
      .prepare("DELETE FROM sessions WHERE sid IN (SELECT sid FROM sessions WHERE expires_at <= ? LIMIT ?)")
      .run(now, PRUNE_MAX_ROWS_PER_RUN);
  }
}
