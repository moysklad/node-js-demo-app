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
  logger[level.toLowerCase() as "debug" | "info" | "warn" | "error"](
    { ...(meta ? { meta: redactSensitiveLogData(meta) } : {}) },
    message
  );
}

function createLogger(): pino.Logger {
  const level = config.logLevel.toLowerCase();
  const usePretty = config.logLevel === "DEBUG";
  const options: pino.LoggerOptions = {
    level,
    redact: {
      paths: [...REDACT_PATHS],
      censor: PII_REDACTED
    }
  };

  if (usePretty) {
    return pino(
      options,
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

  return pino(options);
}

export function redactSensitiveLogData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveLogData);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveLogKey(key) ? PII_REDACTED : redactSensitiveLogData(child);
  }

  return result;
}

function isSensitiveLogKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return [
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "token",
    "access_token",
    "accesstoken",
    "refresh_token",
    "refreshtoken",
    "secret",
    "password",
    "apikey",
    "appsecret",
    "sessionsecret"
  ].includes(normalizedKey);
}
