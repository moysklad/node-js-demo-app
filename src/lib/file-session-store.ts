import fs from "node:fs";
import path from "node:path";
import session from "express-session";
import { ensurePrivateDir, writePrivateFileAtomic } from "./security";

type SessionRecord = {
  expiresAt: number;
  session: session.SessionData;
};

const PRUNE_INTERVAL_MS = 60_000;
const PRUNE_MAX_FILES_PER_RUN = 200;

export class FileSessionStore extends session.Store {
  private readonly directory: string;
  private lastPruneAt = 0;

  constructor(directory: string) {
    super();
    this.directory = directory;
    ensurePrivateDir(this.directory);
  }

  override get(sid: string, callback: (err?: unknown, sessionData?: session.SessionData | null) => void): void {
    try {
      const filename = this.filename(sid);

      if (!fs.existsSync(filename)) {
        callback(undefined, null);
        return;
      }

      const record = JSON.parse(fs.readFileSync(filename, "utf-8")) as SessionRecord;

      if (record.expiresAt <= Date.now()) {
        fs.rmSync(filename, { force: true });
        callback(undefined, null);
        return;
      }

      callback(undefined, record.session);
    } catch (error) {
      callback(error, null);
    }
  }

  override set(sid: string, sessionData: session.SessionData, callback?: (err?: unknown) => void): void {
    try {
      this.maybePruneExpiredSessions();
      const filename = this.filename(sid);
      const record: SessionRecord = {
        expiresAt: this.resolveExpiresAt(sessionData),
        session: sessionData
      };

      writePrivateFileAtomic(filename, JSON.stringify(record));
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      fs.rmSync(this.filename(sid), { force: true });
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override touch(sid: string, sessionData: session.SessionData, callback?: (err?: unknown) => void): void {
    this.set(sid, sessionData, callback);
  }

  private filename(sid: string): string {
    const safeSessionId = encodeURIComponent(sid);
    return path.join(this.directory, `${safeSessionId}.session.json`);
  }

  private resolveExpiresAt(sessionData: session.SessionData): number {
    const expires = sessionData.cookie?.expires;

    if (expires instanceof Date) {
      return expires.getTime();
    }

    return Date.now() + 24 * 60 * 60 * 1000;
  }

  private pruneExpiredSessions(): void {
    let checkedFiles = 0;

    for (const entry of fs.readdirSync(this.directory)) {
      if (!entry.endsWith(".session.json")) {
        continue;
      }

      checkedFiles += 1;

      if (checkedFiles > PRUNE_MAX_FILES_PER_RUN) {
        break;
      }

      const filename = path.join(this.directory, entry);

      try {
        const record = JSON.parse(fs.readFileSync(filename, "utf-8")) as SessionRecord;

        if (record.expiresAt <= Date.now()) {
          fs.rmSync(filename, { force: true });
        }
      } catch {
        fs.rmSync(filename, { force: true });
      }
    }
  }

  private maybePruneExpiredSessions(): void {
    const now = Date.now();

    if (now - this.lastPruneAt < PRUNE_INTERVAL_MS) {
      return;
    }

    this.lastPruneAt = now;
    this.pruneExpiredSessions();
  }
}
