import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Request } from "express";
import {
  USER_CONTEXT_SESSION_REFRESH_INTERVAL_MS,
  USER_CONTEXT_SESSION_KEY,
  USER_CONTEXT_SESSION_TTL_SECONDS,
  loadActiveUserContextFromSession,
  resolveBackendContextFromSession,
  roleToIsAdmin,
  saveActiveUserContextToSession
} from "../src/lib/session/user-context";

function requestWithSession(session: Record<string, unknown>, body: Record<string, unknown> = {}): Request {
  return {
    body,
    session
  } as unknown as Request;
}

describe("Контекст пользователя в сессии", () => {
  test("активный контекст сохраняется с contextNonce и без contextKey", () => {
    const session: Record<string, unknown> = {};
    const req = requestWithSession(session);

    const context = saveActiveUserContextToSession(req, {
      uid: " user-1 ",
      fio: "Иван Иванов",
      accountId: " account-1 ",
      isAdmin: true
    });

    const stored = session[USER_CONTEXT_SESSION_KEY] as Record<string, unknown>;

    assert.equal(context.uid, "user-1");
    assert.equal(context.accountId, "account-1");
    assert.equal(typeof context.contextNonce, "string");
    assert.notEqual(context.contextNonce, "");
    assert.equal("contextKey" in stored, false);
    assert.equal(stored.contextNonce, context.contextNonce);
  });

  test("contextNonce переиспользуется для того же пользователя и меняется при смене прав", () => {
    const session: Record<string, unknown> = {};
    const req = requestWithSession(session);

    const first = saveActiveUserContextToSession(req, {
      uid: "user-1",
      fio: "Иван Иванов",
      accountId: "account-1",
      isAdmin: true
    });
    const second = saveActiveUserContextToSession(req, {
      uid: "user-1",
      fio: "Иван Петров",
      accountId: "account-1",
      isAdmin: true
    });
    const third = saveActiveUserContextToSession(req, {
      uid: "user-1",
      fio: "Иван Петров",
      accountId: "account-1",
      isAdmin: false
    });

    assert.equal(second.contextNonce, first.contextNonce);
    assert.notEqual(third.contextNonce, first.contextNonce);
  });

  test("backend-контекст доступен только при совпадающем contextNonce", () => {
    const session: Record<string, unknown> = {};
    const seedReq = requestWithSession(session);
    const saved = saveActiveUserContextToSession(seedReq, {
      uid: "user-1",
      fio: "Иван Иванов",
      accountId: "account-1",
      isAdmin: true
    });

    assert.equal(resolveBackendContextFromSession(requestWithSession(session, { contextNonce: "wrong" })), null);
    assert.equal(resolveBackendContextFromSession(requestWithSession(session, { contextKey: "context-key" })), null);

    const resolved = resolveBackendContextFromSession(
      requestWithSession(session, { contextNonce: saved.contextNonce })
    );

    assert.deepEqual(resolved, {
      accountId: "account-1",
      uid: "user-1",
      isAdmin: true
    });
  });

  test("backend-контекст обновляет TTL не чаще раза в пять минут", () => {
    const originalNow = Date.now;
    const startedAt = 1_000_000;
    let now = startedAt;
    Date.now = () => now;

    try {
      const session: Record<string, unknown> = {};
      const saved = saveActiveUserContextToSession(requestWithSession(session), {
        uid: "user-1",
        fio: "Иван Иванов",
        accountId: "account-1",
        isAdmin: true
      });
      const initialEntry = session[USER_CONTEXT_SESSION_KEY];

      now += USER_CONTEXT_SESSION_REFRESH_INTERVAL_MS - 1;
      resolveBackendContextFromSession(requestWithSession(session, { contextNonce: saved.contextNonce }));
      assert.equal(session[USER_CONTEXT_SESSION_KEY], initialEntry);

      now += 1;
      resolveBackendContextFromSession(requestWithSession(session, { contextNonce: saved.contextNonce }));
      const refreshed = session[USER_CONTEXT_SESSION_KEY] as { expiresAt: number };

      assert.notEqual(refreshed, initialEntry);
      assert.equal(refreshed.expiresAt, now + USER_CONTEXT_SESSION_TTL_SECONDS * 1000);
    } finally {
      Date.now = originalNow;
    }
  });

  test("истекший активный контекст удаляется из сессии", () => {
    const session: Record<string, unknown> = {
      [USER_CONTEXT_SESSION_KEY]: {
        uid: "user-1",
        fio: "Иван Иванов",
        accountId: "account-1",
        isAdmin: true,
        contextNonce: "nonce-1",
        createdAt: 1,
        expiresAt: 1
      }
    };

    assert.equal(loadActiveUserContextFromSession(requestWithSession(session)), null);
    assert.equal(USER_CONTEXT_SESSION_KEY in session, false);
  });

  test("только роль admin дает административные права", () => {
    assert.equal(roleToIsAdmin("admin"), true);
    assert.equal(roleToIsAdmin("cashier"), false);
    assert.equal(roleToIsAdmin("worker"), false);
    assert.equal(roleToIsAdmin("individual"), false);
  });
});
