import { randomBytes } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { CookieOptions, SessionOptions, Store } from "express-session";
import type { UserContextRole, VendorApiContextResponse } from "../domain/types";
import { vendorApi } from "../integrations/vendor-api";
import { logMessage } from "../observability/logger";

export const USER_CONTEXT_SESSION_KEY = "userContext";
export const USER_CONTEXT_SESSION_TTL_SECONDS = 7200;

export type UserContextSessionEntry = {
  uid: string;
  fio: string;
  accountId: string;
  isAdmin: boolean;
  contextNonce: string;
  createdAt: number;
  expiresAt: number;
};

export type ResolvedBackendAuthContext = {
  accountId: string;
  uid: string;
  isAdmin: boolean;
};

declare module "express-session" {
  interface SessionData {
    userContext?: UserContextSessionEntry;
  }
}

declare global {
  namespace Express {
    interface Locals {
      userContext?: UserContextSessionEntry;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function generateContextNonce(): string {
  return randomBytes(16).toString("base64url");
}

function normalizeUserContextSessionEntry(value: unknown): UserContextSessionEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const accountId = typeof value.accountId === "string" ? value.accountId.trim() : "";
  const uid = typeof value.uid === "string" ? value.uid.trim() : "";
  const contextNonce = typeof value.contextNonce === "string" ? value.contextNonce.trim() : "";

  if (accountId === "" || uid === "" || contextNonce === "") {
    return null;
  }

  const now = Date.now();
  const createdAt =
    typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
      ? value.createdAt
      : now;
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : createdAt + USER_CONTEXT_SESSION_TTL_SECONDS * 1000;

  if (expiresAt <= now) {
    return null;
  }

  return {
    accountId,
    uid,
    fio: typeof value.fio === "string" ? value.fio : "",
    isAdmin: Boolean(value.isAdmin),
    contextNonce,
    createdAt,
    expiresAt
  };
}

function toSessionEntry(context: UserContextSessionEntry): UserContextSessionEntry {
  return {
    uid: context.uid,
    fio: context.fio,
    accountId: context.accountId,
    isAdmin: context.isAdmin,
    contextNonce: context.contextNonce,
    createdAt: context.createdAt,
    expiresAt: context.expiresAt
  };
}

function sameBackendIdentity(
  context: UserContextSessionEntry,
  uid: string,
  accountId: string,
  isAdmin: boolean
): boolean {
  return context.uid === uid && context.accountId === accountId && context.isAdmin === isAdmin;
}

export function normalizeIsAdmin(rawIsAdmin: unknown): boolean {
  if (typeof rawIsAdmin === "boolean") {
    return rawIsAdmin;
  }

  if (typeof rawIsAdmin === "string") {
    return rawIsAdmin.trim().toUpperCase() === "ALL";
  }

  return false;
}

export function checkIsAdmin(employee: VendorApiContextResponse | null): boolean {
  if (!employee?.permissions?.admin) {
    return false;
  }

  return normalizeIsAdmin(employee.permissions.admin.view ?? null);
}

export function roleToIsAdmin(role: UserContextRole): boolean {
  // The final role contract grants administrative authority only to `admin`.
  // `individual` identifies an individual account context, not an administrator permission.
  return role === "admin";
}

export function saveActiveUserContextToSession(
  req: Request,
  context: Omit<UserContextSessionEntry, "contextNonce" | "createdAt" | "expiresAt">
): UserContextSessionEntry {
  const previous = normalizeUserContextSessionEntry(req.session[USER_CONTEXT_SESSION_KEY]);
  const normalizedUid = context.uid.trim();
  const normalizedAccountId = context.accountId.trim();
  const now = Date.now();
  const shouldReuseNonce =
    previous && sameBackendIdentity(previous, normalizedUid, normalizedAccountId, context.isAdmin);

  const nextContext: UserContextSessionEntry = {
    uid: normalizedUid,
    fio: context.fio,
    accountId: normalizedAccountId,
    isAdmin: context.isAdmin,
    contextNonce: shouldReuseNonce ? previous.contextNonce : generateContextNonce(),
    createdAt: shouldReuseNonce ? previous.createdAt : now,
    expiresAt: now + USER_CONTEXT_SESSION_TTL_SECONDS * 1000
  };

  req.session[USER_CONTEXT_SESSION_KEY] = toSessionEntry(nextContext);
  return nextContext;
}

export function loadActiveUserContextFromSession(req: Request): UserContextSessionEntry | null {
  const context = normalizeUserContextSessionEntry(req.session[USER_CONTEXT_SESSION_KEY]);

  if (!context) {
    delete req.session[USER_CONTEXT_SESSION_KEY];
    return null;
  }

  return context;
}

export function refreshActiveUserContextInSession(req: Request, context: UserContextSessionEntry): void {
  req.session[USER_CONTEXT_SESSION_KEY] = toSessionEntry({
    ...context,
    expiresAt: Date.now() + USER_CONTEXT_SESSION_TTL_SECONDS * 1000
  });
}

export function getContextKeyFromRequest(req: Request): string | null {
  const queryContextKey = req.query?.contextKey ?? null;

  if (queryContextKey === null || typeof queryContextKey !== "string") {
    return null;
  }

  const trimmedContextKey = queryContextKey.trim();
  return trimmedContextKey === "" ? null : trimmedContextKey;
}

export function getContextNonceFromRequest(req: Request): string | null {
  const bodyContextNonce =
    req.body && typeof req.body === "object" && "contextNonce" in req.body
      ? (req.body as Record<string, unknown>).contextNonce
      : null;

  if (bodyContextNonce === null || typeof bodyContextNonce !== "string") {
    return null;
  }

  const trimmedContextNonce = bodyContextNonce.trim();
  return trimmedContextNonce === "" ? null : trimmedContextNonce;
}

export function resolveBackendContextFromSession(req: Request): ResolvedBackendAuthContext | null {
  const contextNonce = getContextNonceFromRequest(req);

  if (contextNonce === null) {
    return null;
  }

  const context = loadActiveUserContextFromSession(req);

  if (!context || context.contextNonce !== contextNonce) {
    return null;
  }

  refreshActiveUserContextInSession(req, context);

  const accountId = context.accountId.trim();
  const uid = context.uid.trim();

  if (accountId === "" || uid === "") {
    return null;
  }

  return {
    accountId,
    uid,
    isAdmin: context.isAdmin
  };
}

export function getUserContextFromLocals(res: Response): UserContextSessionEntry | null {
  return res.locals.userContext ?? null;
}

export function loadUserContextMiddleware(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const contextKey = getContextKeyFromRequest(req);

    if (contextKey === null) {
      res.status(401).send("Ошибка авторизации: параметр contextKey обязателен");
      return;
    }

    logMessage("DEBUG", "Loading user context from Vendor API");

    try {
      const employee = await vendorApi().context(contextKey);

      if (!employee || !employee.accountId || !employee.uid) {
        res.status(401).send("Ошибка авторизации: не удалось получить контекст пользователя");
        return;
      }

      const uid = employee.uid.trim();
      const accountId = employee.accountId.trim();

      if (uid === "" || accountId === "") {
        res.status(401).send("Ошибка авторизации: не удалось получить контекст пользователя");
        return;
      }

      const context = saveActiveUserContextToSession(req, {
        uid,
        fio: employee.shortFio ?? "",
        accountId,
        isAdmin: checkIsAdmin(employee)
      });

      res.locals.userContext = context;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      logMessage("ERROR", message);
      res.status(401).send("Ошибка авторизации: не удалось получить контекст пользователя");
    }
  };
}

export type BuildSessionMiddlewareParams = {
  secret: string;
  name: string;
  store: Store;
  cookie: Partial<CookieOptions>;
};

export function buildSessionMiddlewareOptions(params: BuildSessionMiddlewareParams): SessionOptions {
  const { secret, name, store, cookie } = params;

  return {
    secret,
    name,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: USER_CONTEXT_SESSION_TTL_SECONDS * 1000,
      ...cookie
    }
  };
}
