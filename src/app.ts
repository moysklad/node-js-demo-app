import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import session from "express-session";
import { z } from "zod";
import { createVendorEndpointRouter } from "./api/vendor-endpoint";
import { config, validateRequiredRuntimeConfig } from "./lib/config";
import { FileSessionStore } from "./lib/file-session-store";
import { logMessage } from "./lib/logger";
import { ensurePrivateDir } from "./lib/security";
import { buildSessionMiddlewareOptions } from "./lib/user-context";
import { buildDescriptorXml } from "./utils/descriptor";
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
  app.set("views", path.join(process.cwd(), "src/views"));

  if (config.trustProxy > 0 || options.sessionCookieSecure) {
    app.set("trust proxy", config.trustProxy > 0 ? config.trustProxy : 1);
  }

  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: true, limit: "64kb" }));
  app.use("/assets", express.static(path.join(process.cwd(), "public/assets")));
  app.use(createRequestLoggingMiddleware());
  app.use(
    session(
      {
        ...buildSessionMiddlewareOptions(config.sessionSecret, {
          sameSite: config.sessionCookieSameSite,
          secure: sessionCookieSecure
        }),
        name: config.sessionName,
        store: sessionStore
      }
    )
  );

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      status: "healthy",
      uptimeSeconds: Math.round(process.uptime())
    });
  });

  app.get("/ready", (_req, res) => {
    const checks = buildReadinessChecks();
    const ok = Object.values(checks).every(Boolean);

    res.status(ok ? 200 : 503).json({
      ok,
      status: ok ? "ready" : "not_ready",
      checks
    });
  });

  app.get("/descriptor.xml", (_req, res) => {
    sendDescriptorXml(res);
  });

  app.use("/api/vendor-endpoint", createVendorEndpointRouter());
  app.use("/entry", createEntryRouter());
  app.use("/utils", createUtilsRouter());

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      logMessage("ERROR", error instanceof Error ? error.stack ?? error.message : String(error));
      next(error);
      return;
    }

    if (error instanceof z.ZodError) {
      logMessage("WARN", "Request validation failed", { details: error.flatten() });
      res.status(400).json({
        error: "ValidationError",
        details: error.flatten()
      });
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

    res.on("finish", () => {
      logMessage("INFO", "HTTP request completed", {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    next();
  };
}

function buildReadinessChecks(): Record<string, boolean> {
  return {
    appId: config.appId !== "",
    appUid: config.appUid !== "",
    appBaseUrl: config.appBaseUrl !== "",
    appSecretKey: config.secretKey !== "",
    sessionSecret: config.sessionSecret !== "",
    dataDirWritable: isWritableDirectory(config.dataDir),
    sessionDirWritable: isWritableDirectory(config.sessionDir)
  };
}

function sendDescriptorXml(res: Response): void {
  res.type("application/xml");
  res.send(buildDescriptorXml());
}

function isWritableDirectory(directory: string): boolean {
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.accessSync(directory, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
