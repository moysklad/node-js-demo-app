import path from "node:path";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import session from "express-session";
import { createVendorEndpointRouter } from "./api/vendor-endpoint";
import { appVersion } from "./lib/config/app-version";
import { config, validateRequiredRuntimeConfig } from "./lib/config/config";
import { AppInstance } from "./lib/domain/app-instance";
import { SqliteAppInstanceRepository } from "./lib/domain/app-instance-sqlite-repository";
import { logMessage } from "./lib/observability/logger";
import { JwtReplay, SqliteJwtReplayRepository } from "./lib/security/jwt-replay-repository";
import { ensurePrivateDir } from "./lib/security/security";
import { SqliteSessionStore } from "./lib/session/sqlite-session-store";
import { buildSessionMiddlewareOptions } from "./lib/session/user-context";
import { createUtilsRouter } from "./utils/router";
import { createEntryRouter } from "./entry/router";
import { registerLoyalty } from "./loyalty";

export type CreateAppOptions = {
  sessionCookieSecure?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  validateRequiredRuntimeConfig();
  const app = express();
  AppInstance.configureRepository(new SqliteAppInstanceRepository(config.appDbPath));
  JwtReplay.configureRepository(new SqliteJwtReplayRepository(config.appDbPath));
  const sessionStore = new SqliteSessionStore(config.appDbPath);
  const sessionCookieSecure = options.sessionCookieSecure ?? config.sessionCookieSecure;

  ensurePrivateDir(config.dataDir);

  if (config.trustProxy > 0 || options.sessionCookieSecure) {
    app.set("trust proxy", config.trustProxy > 0 ? config.trustProxy : 1);
  }

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      status: "healthy",
      // Версия решения в ответе health-check помогает убедиться, что развернут ожидаемый образ.
      version: appVersion(),
      uptimeSeconds: Math.round(process.uptime())
    });
  });

  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: true, limit: "64kb" }));
  app.use("/assets", express.static(resolveAssetsDirectory()));
  app.use(createRequestLoggingMiddleware());
  app.use(
    session(
      buildSessionMiddlewareOptions({
        secret: config.sessionSecret,
        name: config.sessionName,
        store: sessionStore,
        cookie: {
          sameSite: config.sessionCookieSameSite,
          secure: sessionCookieSecure
        }
      })
    )
  );

  app.use("/vendor-endpoint", createVendorEndpointRouter());
  app.use("/entry", createEntryRouter());
  app.use("/utils", createUtilsRouter());
  // [feature:loyalty] программа лояльности: единственное место подключения модуля src/loyalty
  // (роуты /loyalty и /utils/connect-loyalty, репозиторий, error handler в формате Loyalty API).
  registerLoyalty(app);

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      logMessage("ERROR", error instanceof Error ? error.stack ?? error.message : String(error));
      next(error);
      return;
    }

    logMessage("ERROR", error instanceof Error ? error.stack ?? error.message : String(error));
    res.status(500).send("Internal Server Error");
  });

  return app;
}

function createRequestLoggingMiddleware(): RequestHandler {
  return (req, res, next) => {
    const startedAt = Date.now();
    const shouldLogBodyKeys = req.path.startsWith("/vendor-endpoint");

    logMessage("DEBUG", "HTTP request started", {
      method: req.method,
      path: req.path,
      queryKeys: Object.keys(req.query ?? {}),
      headerNames: Object.keys(req.headers),
      ...(shouldLogBodyKeys && req.body && typeof req.body === "object"
        ? { bodyKeys: Object.keys(req.body as Record<string, unknown>) }
        : {})
    });

    res.on("finish", () => {
      logMessage("DEBUG", "HTTP request completed", {
        method: req.method,
        path: req.path,
        queryKeys: Object.keys(req.query ?? {}),
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    next();
  };
}

function resolveAssetsDirectory(): string {
  if (process.env.NODE_ENV === "production") {
    return path.join(process.cwd(), "dist/public/assets");
  }

  return path.join(process.cwd(), "public/assets");
}
