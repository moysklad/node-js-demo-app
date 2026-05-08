import pino from "pino";
import { config, type LogLevel } from "../config/config";

const PII_REDACTED = "[REDACTED]";
const REDACT_PATHS = [
  "meta.headers.authorization",
  "meta.headers.Authorization",
  "meta.headers.cookie",
  "meta.headers.Cookie",
  "meta.headers['set-cookie']",
  "meta.headers['Set-Cookie']",
  "meta.headers['x-api-key']",
  "meta.headers['X-API-Key']",
  "meta.body.access_token",
  "meta.body.accessToken",
  "meta.body.access[*].access_token",
  "meta.body.refresh_token",
  "meta.body.refreshToken",
  "meta.body.secret",
  "meta.body.password",
  "meta.body.token",
  "meta.body.auth.token",
  "meta.body.auth.refresh_token",
  "meta.body.auth.access_token",
  "meta.body.apiKey",
  "meta.body.appSecret",
  "meta.body.sessionSecret",
  "meta.body.credentials.password",
  "meta.body.credentials.secret"
] as const;
const logger = createLogger();

export function logMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  logger[level.toLowerCase() as "debug" | "info" | "warn" | "error"]({ ...(meta ? { meta } : {}) }, message);
}

function createLogger(): pino.Logger {
  const level = config.logLevel.toLowerCase();
  const usePretty = config.logLevel === "DEBUG";

  if (usePretty) {
    return pino(
      { level },
      pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: true,
          translateTime: "SYS:standard"
        }
      })
    );
  }

  return pino({
    level,
    redact: {
      paths: [...REDACT_PATHS],
      censor: PII_REDACTED
    }
  });
}
