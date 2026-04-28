import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).optional(),
  APP_ID: z.string().optional(),
  APP_UID: z.string().optional(),
  APP_SECRET_KEY: z.string().optional(),
  APP_BASE_URL: z.url().optional(),
  DESCRIPTOR_VENDOR_API_BASE_URL: z.url().optional(),
  MOYSKLAD_VENDOR_API_ENDPOINT_URL: z.url().optional(),
  MOYSKLAD_JSON_API_ENDPOINT_URL: z.url().optional(),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  HTTP_MAX_RETRIES: z.coerce.number().int().min(0).max(5).optional(),
  HTTP_RETRY_BASE_MS: z.coerce.number().int().min(10).optional(),
  SESSION_SECRET: z.string().optional(),
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional().transform((value) => {
    if (value == null) {
      return undefined;
    }
    return value === "true";
  }),
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).optional(),
  SESSION_NAME: z.string().optional(),
  SESSION_DIR: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).optional(),
  DATA_DIR: z.string().optional()
});

const env = envSchema.parse(process.env);

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export class AppConfig {
  appId = "";
  appUid = "";
  secretKey = "";
  appBaseUrl = "http://localhost:3000";
  descriptorVendorApiBaseUrl = "http://localhost:3000";
  moyskladVendorApiEndpointUrl = "https://apps-api.moysklad.ru/api/vendor/1.0";
  moyskladJsonApiEndpointUrl = "https://api.moysklad.ru/api/remap/1.2";
  httpTimeoutMs = 30000;
  httpMaxRetries = 2;
  httpRetryBaseMs = 250;
  port = 3000;
  logLevel: LogLevel = "DEBUG";
  sessionSecret = "change-me";
  sessionCookieSecure = true;
  sessionCookieSameSite: "lax" | "strict" | "none" = "none";
  sessionName = "connect.sid";
  // Директория для хранения состояния сессий (в текущей реализации — файловый store).
  sessionDir = path.resolve(process.cwd(), "./tmp/data/sessions");
  // Включает режим trust proxy в Express при работе за ingress/reverse proxy.
  trustProxy = 1;
  // Базовая директория для runtime-данных приложения (сессии, jti-маркеры и т.д.).
  dataDir = path.resolve(process.cwd(), "./tmp/data");
}

export const config = fromEnv(env);

export function cfg(): AppConfig {
  return config;
}

function fromEnv(value: typeof env): AppConfig {
  const next = new AppConfig();

  // Базовые настройки приложения и рантайма.
  if (value.PORT !== undefined) {
    next.port = value.PORT;
  }

  if (value.LOG_LEVEL !== undefined) {
    next.logLevel = value.LOG_LEVEL;
  }

  if (value.APP_ID !== undefined) {
    next.appId = value.APP_ID;
  }

  if (value.APP_UID !== undefined) {
    next.appUid = value.APP_UID;
  }

  if (value.APP_SECRET_KEY !== undefined) {
    next.secretKey = value.APP_SECRET_KEY;
  }

  if (value.APP_BASE_URL !== undefined) {
    next.appBaseUrl = value.APP_BASE_URL;
  }

  if (value.DESCRIPTOR_VENDOR_API_BASE_URL !== undefined) {
    next.descriptorVendorApiBaseUrl = value.DESCRIPTOR_VENDOR_API_BASE_URL;
  } else if (value.APP_BASE_URL !== undefined) {
    next.descriptorVendorApiBaseUrl = value.APP_BASE_URL;
  }

  // Настройки внешних интеграций.
  if (value.MOYSKLAD_VENDOR_API_ENDPOINT_URL !== undefined) {
    next.moyskladVendorApiEndpointUrl = value.MOYSKLAD_VENDOR_API_ENDPOINT_URL;
  }

  if (value.MOYSKLAD_JSON_API_ENDPOINT_URL !== undefined) {
    next.moyskladJsonApiEndpointUrl = value.MOYSKLAD_JSON_API_ENDPOINT_URL;
  }

  if (value.HTTP_TIMEOUT_MS !== undefined) {
    next.httpTimeoutMs = value.HTTP_TIMEOUT_MS;
  }

  if (value.HTTP_MAX_RETRIES !== undefined) {
    next.httpMaxRetries = value.HTTP_MAX_RETRIES;
  }

  if (value.HTTP_RETRY_BASE_MS !== undefined) {
    next.httpRetryBaseMs = value.HTTP_RETRY_BASE_MS;
  }

  // Настройки сессии.
  if (value.SESSION_SECRET !== undefined) {
    next.sessionSecret = value.SESSION_SECRET;
  }

  if (value.SESSION_COOKIE_SECURE !== undefined) {
    next.sessionCookieSecure = value.SESSION_COOKIE_SECURE;
  }

  if (value.SESSION_COOKIE_SAME_SITE !== undefined) {
    next.sessionCookieSameSite = value.SESSION_COOKIE_SAME_SITE;
  }

  if (value.SESSION_NAME !== undefined) {
    next.sessionName = value.SESSION_NAME;
  }

  if (value.SESSION_DIR !== undefined) {
    next.sessionDir = path.resolve(process.cwd(), value.SESSION_DIR);
  }

  if (value.TRUST_PROXY !== undefined) {
    next.trustProxy = value.TRUST_PROXY;
  }

  // Локальные файловые пути.
  if (value.DATA_DIR !== undefined) {
    next.dataDir = path.resolve(process.cwd(), value.DATA_DIR);
  }

  return next;
}

export function validateRequiredRuntimeConfig(): void {
  const missing: string[] = [];

  if (!config.appId) {
    missing.push("APP_ID");
  }

  if (!config.appUid) {
    missing.push("APP_UID");
  }

  if (!config.appBaseUrl) {
    missing.push("APP_BASE_URL");
  }

  if (!config.secretKey) {
    missing.push("APP_SECRET_KEY");
  }

  if (!config.sessionSecret || config.sessionSecret === "change-me") {
    missing.push("SESSION_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required runtime config: ${missing.join(", ")}`);
  }
}
