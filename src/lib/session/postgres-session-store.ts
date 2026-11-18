import session from "express-session";
import type { Pool } from "pg";
import { decryptSensitiveOrNull, encryptSensitive } from "../security/security";

type SessionRow = {
  session_json: string;
  expires_at: number;
};

const PRUNE_INTERVAL_MS = 60_000;
const PRUNE_MAX_ROWS_PER_RUN = 500;
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

type StoreCallback<T = void> = (err?: unknown, result?: T) => void;

export class PostgresSessionStore extends session.Store {
  private readonly lastPersistedAt = new Map<string, number>();
  private lastPruneAt = 0;

  constructor(private readonly pool: Pool) {
    super();
  }

  override get(sid: string, callback: (err?: unknown, sessionData?: session.SessionData | null) => void): void {
    this.run(callback, async () => {
      const { rows } = await this.pool.query<SessionRow>("SELECT session_json, expires_at FROM sessions WHERE sid = $1", [sid]);
      const row = rows[0];

      if (!row) {
        return null;
      }

      if (row.expires_at <= Date.now()) {
        await this.pool.query("DELETE FROM sessions WHERE sid = $1", [sid]);
        return null;
      }

      const sessionJson = decryptSensitiveOrNull(row.session_json, "Session");
      return sessionJson === null ? null : (JSON.parse(sessionJson) as session.SessionData);
    });
  }

  override set(sid: string, sessionData: session.SessionData, callback?: StoreCallback): void {
    this.run(callback, async () => {
      await this.maybePruneExpiredSessions();
      await this.pool.query(
        `
          INSERT INTO sessions (sid, session_json, expires_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (sid) DO UPDATE SET
            session_json = excluded.session_json,
            expires_at = excluded.expires_at
        `,
        [sid, encryptSensitive(JSON.stringify(sessionData)), this.resolveExpiresAt(sessionData)]
      );
      this.lastPersistedAt.set(sid, Date.now());
    });
  }

  override destroy(sid: string, callback?: StoreCallback): void {
    this.run(callback, async () => {
      await this.pool.query("DELETE FROM sessions WHERE sid = $1", [sid]);
      this.lastPersistedAt.delete(sid);
    });
  }

  override touch(sid: string, sessionData: session.SessionData, callback?: StoreCallback): void {
    this.run(callback, async () => {
      const now = Date.now();
      const lastPersistedAt = this.lastPersistedAt.get(sid);

      if (lastPersistedAt != null && now - lastPersistedAt < SESSION_TOUCH_INTERVAL_MS) {
        return;
      }

      const expiresAt = this.resolveExpiresAt(sessionData);
      await this.pool.query("UPDATE sessions SET expires_at = $1 WHERE sid = $2 AND expires_at <= $3", [
        expiresAt,
        sid,
        expiresAt - SESSION_TOUCH_INTERVAL_MS
      ]);
      this.lastPersistedAt.set(sid, now);
    });
  }

  private run<T>(callback: StoreCallback<T> | undefined, operation: () => Promise<T>): void {
    operation().then(
      (result) => callback?.(undefined, result),
      (error: unknown) => callback?.(error)
    );
  }

  private resolveExpiresAt(sessionData: session.SessionData): number {
    const expires = sessionData.cookie?.expires;

    if (expires instanceof Date) {
      return expires.getTime();
    }

    return Date.now() + DEFAULT_SESSION_TTL_MS;
  }

  private async maybePruneExpiredSessions(): Promise<void> {
    const now = Date.now();

    if (now - this.lastPruneAt < PRUNE_INTERVAL_MS) {
      return;
    }

    this.lastPruneAt = now;
    await this.pool.query("DELETE FROM sessions WHERE sid IN (SELECT sid FROM sessions WHERE expires_at <= $1 LIMIT $2)", [
      now,
      PRUNE_MAX_ROWS_PER_RUN
    ]);

    for (const [sid, persistedAt] of this.lastPersistedAt) {
      if (now - persistedAt >= DEFAULT_SESSION_TTL_MS) {
        this.lastPersistedAt.delete(sid);
      }
    }
  }
}
