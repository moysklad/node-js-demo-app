import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { CookieOptions, SessionOptions, Store } from "express-session";
import { logMessage } from "../observability/logger";
import { vendorApi } from "../integrations/vendor-api";
import type { VendorApiContextResponse } from "../domain/types";

export const USER_CONTEXT_SESSION_KEY = "userContext";
export const USER_CONTEXT_STACK_LIMIT = 10;
export const USER_CONTEXT_SESSION_TTL_SECONDS = 7200;

export type UserContextSessionEntry = {
  uid: string;
  fio: string;
  accountId: string;
  isAdmin: boolean;
  contextKey: string;
  createdAt: number;
  expiresAt: number;
};

export type ResolvedBackendAuthContext = {
  accountId: string;
  uid: string;
  isAdmin: boolean;
};

export type UserContextSessionBucket = {
  byContextKey: Record<string, UserContextSessionEntry>;
  contextKeyStack: string[];
};

declare module "express-session" {
  interface SessionData {
    userContext?: UserContextSessionBucket;
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

function normalizeUserContextSessionEntry(contextKey: string, value: unknown): UserContextSessionEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const accountId = typeof value.accountId === "string" ? value.accountId.trim() : "";
  const uid = typeof value.uid === "string" ? value.uid.trim() : "";

  if (accountId === "" || uid === "") {
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
    contextKey,
    createdAt,
    expiresAt
  };
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

export function trimUserContextBucket(bucket: UserContextSessionBucket): void {
  const rawContexts = isRecord(bucket.byContextKey) ? bucket.byContextKey : {};
  const rawStack = Array.isArray(bucket.contextKeyStack) ? bucket.contextKeyStack : [];

  const contexts: Record<string, UserContextSessionEntry> = {};

  for (const [contextKey, value] of Object.entries(rawContexts)) {
    if (contextKey === "") {
      continue;
    }

    const normalized = normalizeUserContextSessionEntry(contextKey, value);
    if (normalized) {
      contexts[contextKey] = normalized;
    }
  }

  const stack: string[] = [];
  const seen = new Set<string>();

  for (const contextKey of rawStack) {
    if (contextKey === "" || !(contextKey in contexts) || seen.has(contextKey)) {
      continue;
    }

    seen.add(contextKey);
    stack.push(contextKey);
  }

  for (const contextKey of Object.keys(contexts)) {
    if (seen.has(contextKey)) {
      continue;
    }

    seen.add(contextKey);
    stack.push(contextKey);
  }

  const limitedStack =
    stack.length > USER_CONTEXT_STACK_LIMIT
      ? stack.slice(-USER_CONTEXT_STACK_LIMIT)
      : stack;

  const validKeys = new Set(limitedStack);
  const limitedContexts: Record<string, UserContextSessionEntry> = {};

  for (const contextKey of limitedStack) {
    limitedContexts[contextKey] = contexts[contextKey];
  }

  bucket.byContextKey = limitedContexts;
  bucket.contextKeyStack = Array.from(validKeys).filter((contextKey) => contextKey in limitedContexts);
}

export function userContextSessionBucket(req: Request): UserContextSessionBucket {
  const currentValue = req.session[USER_CONTEXT_SESSION_KEY];

  if (
    !currentValue ||
    !isRecord(currentValue) ||
    !isRecord(currentValue.byContextKey) ||
    !Array.isArray(currentValue.contextKeyStack)
  ) {
    req.session[USER_CONTEXT_SESSION_KEY] = {
      byContextKey: {},
      contextKeyStack: []
    };
  }

  const bucket = req.session[USER_CONTEXT_SESSION_KEY] as UserContextSessionBucket;
  trimUserContextBucket(bucket);
  return bucket;
}

export function saveUserContextToSession(
  req: Request,
  contextKey: string,
  context: Omit<UserContextSessionEntry, "contextKey" | "createdAt" | "expiresAt">
): void {
  const bucket = userContextSessionBucket(req);
  const normalizedContextKey = contextKey.trim();
  const now = Date.now();

  bucket.byContextKey[normalizedContextKey] = {
    ...context,
    contextKey: normalizedContextKey,
    createdAt: now,
    expiresAt: now + USER_CONTEXT_SESSION_TTL_SECONDS * 1000
  };

  const updatedStack: string[] = [];

  for (const existingKey of bucket.contextKeyStack) {
    if (existingKey !== normalizedContextKey) {
      updatedStack.push(existingKey);
    }
  }

  updatedStack.push(normalizedContextKey);
  bucket.contextKeyStack = updatedStack;

  trimUserContextBucket(bucket);
}

export function loadUserContextFromSession(req: Request, contextKey: string): UserContextSessionEntry | null {
  const bucket = userContextSessionBucket(req);
  const context = bucket.byContextKey[contextKey] ?? null;

  if (!context) {
    return null;
  }

  const now = Date.now();

  if (context.expiresAt <= now) {
    delete bucket.byContextKey[contextKey];
    bucket.contextKeyStack = bucket.contextKeyStack.filter((item) => item !== contextKey);
    return null;
  }

  context.expiresAt = now + USER_CONTEXT_SESSION_TTL_SECONDS * 1000;
  return context;
}

export function getContextKeyFromRequest(req: Request): string | null {
  const bodyContextKey =
    req.body && typeof req.body === "object" && "contextKey" in req.body
      ? (req.body as Record<string, unknown>).contextKey
      : null;
  const queryContextKey = req.query?.contextKey ?? null;
  const contextKey = bodyContextKey ?? queryContextKey ?? null;

  if (contextKey === null || typeof contextKey !== "string") {
    return null;
  }

  const trimmedContextKey = contextKey.trim();
  return trimmedContextKey === "" ? null : trimmedContextKey;
}

export function resolveBackendContextFromSession(req: Request): ResolvedBackendAuthContext | null {
  const contextKey = getContextKeyFromRequest(req);

  if (contextKey === null) {
    return null;
  }

  const context = loadUserContextFromSession(req, contextKey);

  if (!context) {
    return null;
  }

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

    const cachedContext = loadUserContextFromSession(req, contextKey);

    if (cachedContext) {
      logMessage("DEBUG", "Loaded user context from session");
      res.locals.userContext = cachedContext;
      next();
      return;
    }

    logMessage("DEBUG", "Loading user context from Vendor API");

    try {
      const employee = await vendorApi().context(contextKey);

      if (!employee || !employee.accountId || !employee.uid) {
        res.status(401).send("Ошибка авторизации: не удалось получить контекст пользователя");
        return;
      }

      saveUserContextToSession(req, contextKey, {
        uid: employee.uid,
        fio: employee.shortFio ?? "",
        accountId: employee.accountId,
        isAdmin: checkIsAdmin(employee)
      });

      const context = loadUserContextFromSession(req, contextKey);

      if (!context) {
        res.status(401).send("Ошибка авторизации: не удалось получить контекст пользователя");
        return;
      }

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
