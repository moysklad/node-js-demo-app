// Интеграционный тест: работает с настоящим SQLite.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { SessionData } from "express-session";
import { config } from "../../src/lib/config/config";
import { SqliteSessionStore } from "../../src/lib/session/sqlite-session-store";

type SessionRow = {
  session_json: string;
  expires_at: number;
};

const SESSION_ID = "sid-1";
const START_TIME = 1_000_000;
const MINUTE_MS = 60 * 1000;

function callStore(operation: (callback: (error?: unknown) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    operation((error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test("touch пропускает раннюю запись, затем обновляет только срок сессии", async () => {
  const originalNow = Date.now;
  let now = START_TIME;
  Date.now = () => now;
  const directory = mkdtempSync(path.join(os.tmpdir(), "session-store-test-"));
  const filename = path.join(directory, "sessions.sqlite");
  const originalEncryptKey = config.encryptKey;
  config.encryptKey = "ab".repeat(32);
  const store = new SqliteSessionStore(filename);
  const initialExpiresAt = START_TIME + 60 * MINUTE_MS;
  const sessionData = {
    cookie: { expires: new Date(initialExpiresAt) },
    userContext: { uid: "user-1" }
  } as unknown as SessionData;
  let db: DatabaseSync | null = null;

  try {
    await callStore((callback) => store.set(SESSION_ID, sessionData, callback));

    db = new DatabaseSync(filename, { readOnly: true });
    const selectRow = db.prepare("SELECT session_json, expires_at FROM sessions WHERE sid = ?");
    const readRow = (): SessionRow => selectRow.get(SESSION_ID) as SessionRow;
    const initialRow = readRow();

    now = START_TIME + 4 * MINUTE_MS;
    sessionData.cookie.expires = new Date(initialExpiresAt + 4 * MINUTE_MS);
    await callStore((callback) => store.touch(SESSION_ID, sessionData, callback));

    assert.deepEqual(readRow(), initialRow);

    now = START_TIME + 6 * MINUTE_MS;
    sessionData.cookie.expires = new Date(initialExpiresAt + 6 * MINUTE_MS);
    await callStore((callback) => store.touch(SESSION_ID, sessionData, callback));

    const refreshedRow = readRow();
    assert.equal(refreshedRow.expires_at, initialExpiresAt + 6 * MINUTE_MS);
    assert.equal(refreshedRow.session_json, initialRow.session_json);
  } finally {
    db?.close();
    config.encryptKey = originalEncryptKey;
    Date.now = originalNow;
    rmSync(directory, { recursive: true, force: true });
  }
});
