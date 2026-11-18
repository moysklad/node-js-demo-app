// Интеграционный тест: хранилище сессий на настоящем PostgreSQL.
import assert from "node:assert/strict";
import test from "node:test";
import type { SessionData } from "express-session";
import { PostgresSessionStore } from "../../src/lib/session/postgres-session-store";
import { createTestDatabase } from "../db";

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
  const db = await createTestDatabase();
  const store = new PostgresSessionStore(db.pool);
  const initialExpiresAt = START_TIME + 60 * MINUTE_MS;
  const sessionData = {
    cookie: { expires: new Date(initialExpiresAt) },
    userContext: { uid: "user-1" }
  } as unknown as SessionData;
  const readRow = async (): Promise<SessionRow> =>
    (await db.pool.query<SessionRow>("SELECT session_json, expires_at FROM sessions WHERE sid = $1", [SESSION_ID])).rows[0]!;

  try {
    await callStore((callback) => store.set(SESSION_ID, sessionData, callback));
    const initialRow = await readRow();

    now = START_TIME + 4 * MINUTE_MS;
    sessionData.cookie.expires = new Date(initialExpiresAt + 4 * MINUTE_MS);
    await callStore((callback) => store.touch(SESSION_ID, sessionData, callback));

    assert.deepEqual(await readRow(), initialRow);

    now = START_TIME + 6 * MINUTE_MS;
    sessionData.cookie.expires = new Date(initialExpiresAt + 6 * MINUTE_MS);
    await callStore((callback) => store.touch(SESSION_ID, sessionData, callback));

    const refreshedRow = await readRow();
    assert.equal(refreshedRow.expires_at, initialExpiresAt + 6 * MINUTE_MS);
    assert.equal(refreshedRow.session_json, initialRow.session_json);
  } finally {
    Date.now = originalNow;
    await db.close();
  }
});
