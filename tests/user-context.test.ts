import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
  USER_CONTEXT_SESSION_KEY,
  loadActiveUserContextFromSession,
  resolveBackendContextFromSession,
  saveActiveUserContextToSession,
} from "../backend/src/lib/session/user-context";

function requestWithSession(session: Record<string, unknown>, body: Record<string, unknown> = {}): Request {
  return {
    body,
    session,
  } as unknown as Request;
}

test("активный контекст сохраняется с contextNonce и без contextKey", () => {
  const session: Record<string, unknown> = {};
  const req = requestWithSession(session);

  const context = saveActiveUserContextToSession(req, {
    uid: " user-1 ",
    fio: "Иван Иванов",
    accountId: " account-1 ",
    isAdmin: true,
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
    isAdmin: true,
  });
  const second = saveActiveUserContextToSession(req, {
    uid: "user-1",
    fio: "Иван Петров",
    accountId: "account-1",
    isAdmin: true,
  });
  const third = saveActiveUserContextToSession(req, {
    uid: "user-1",
    fio: "Иван Петров",
    accountId: "account-1",
    isAdmin: false,
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
    isAdmin: true,
  });

  assert.equal(resolveBackendContextFromSession(requestWithSession(session, { contextNonce: "wrong" })), null);
  assert.equal(resolveBackendContextFromSession(requestWithSession(session, { contextKey: "context-key" })), null);

  const resolved = resolveBackendContextFromSession(requestWithSession(session, { contextNonce: saved.contextNonce }));

  assert.deepEqual(resolved, {
    accountId: "account-1",
    uid: "user-1",
    isAdmin: true,
  });
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
      expiresAt: 1,
    },
  };

  assert.equal(loadActiveUserContextFromSession(requestWithSession(session)), null);
  assert.equal(USER_CONTEXT_SESSION_KEY in session, false);
});
