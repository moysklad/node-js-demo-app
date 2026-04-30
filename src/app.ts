import path from "node:path";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import session from "express-session";
import { createVendorEndpointRouter } from "./api/vendor-endpoint";
import { config, validateRequiredRuntimeConfig } from "./lib/config/config";
import { FileSessionStore } from "./lib/session/file-session-store";
import { logMessage } from "./lib/observability/logger";
import { ensurePrivateDir } from "./lib/security/security";
import { buildSessionMiddlewareOptions } from "./lib/session/user-context";
import { createUtilsRouter } from "./utils/router";
import { createEntryRouter } from "./entry/router";

export type CreateAppOptions = {
  sessionCookieSecure?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  validateRequiredRuntimeConfig();
  const app = express();
  const sessionStore = new FileSessionStore(config.sessionDir);
  const sessionCookieSecure = options.sessionCookieSecure ?? config.sessionCookieSecure;

  ensurePrivateDir(config.dataDir);
  ensurePrivateDir(config.sessionDir);

  app.set("view engine", "ejs");
  app.set("views", resolveViewsDirectory());

  if (config.trustProxy > 0 || options.sessionCookieSecure) {
    app.set("trust proxy", config.trustProxy > 0 ? config.trustProxy : 1);
  }

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

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      status: "healthy",
      uptimeSeconds: Math.round(process.uptime())
    });
  });

  app.use("/vendor-endpoint", createVendorEndpointRouter());
  app.use("/entry", createEntryRouter());
  app.use("/utils", createUtilsRouter());

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
    logMessage("DEBUG", "HTTP request started", {
      method: req.method,
      path: req.path,
      queryKeys: Object.keys(req.query ?? {}),
      headers: req.headers as Record<string, unknown>
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

function resolveViewsDirectory(): string {
  if (process.env.NODE_ENV === "production") {
    return path.join(process.cwd(), "dist/views");
  }

  return path.join(process.cwd(), "src/views");
}

function resolveAssetsDirectory(): string {
  if (process.env.NODE_ENV === "production") {
    return path.join(process.cwd(), "dist/public/assets");
  }

  return path.join(process.cwd(), "public/assets");
}
