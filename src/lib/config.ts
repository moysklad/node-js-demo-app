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
  appBaseUrl = "";
  descriptorVendorApiBaseUrl = "";
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

  constructor(cfg: Record<string, unknown>) {
    for (const [key, value] of Object.entries(cfg)) {
      if (!(key in this)) {
        continue;
      }

      if (key === "port") {
        this.port = typeof value === "number" ? value : this.port;
        continue;
      }

      if (key === "sessionCookieSecure") {
        this.sessionCookieSecure = typeof value === "boolean" ? value : this.sessionCookieSecure;
        continue;
      }

      if (key === "dataDir") {
        this.dataDir = path.resolve(process.cwd(), value == null || value === false ? "./tmp/data" : String(value));
        continue;
      }

      if (key === "sessionDir") {
        this.sessionDir = path.resolve(process.cwd(), value == null || value === false ? "./tmp/data/sessions" : String(value));
        continue;
      }

      if (key === "trustProxy") {
        this.trustProxy = typeof value === "number" ? value : this.trustProxy;
        continue;
      }

      if (key === "httpTimeoutMs") {
        this.httpTimeoutMs = typeof value === "number" ? value : this.httpTimeoutMs;
        continue;
      }

      if (key === "httpMaxRetries") {
        this.httpMaxRetries = typeof value === "number" ? value : this.httpMaxRetries;
        continue;
      }

      if (key === "httpRetryBaseMs") {
        this.httpRetryBaseMs = typeof value === "number" ? value : this.httpRetryBaseMs;
        continue;
      }

      if (value == null || value === false) {
        continue;
      }

      (this as Record<string, unknown>)[key] = String(value);
    }
  }
}

export const config = new AppConfig({
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  appId: env.APP_ID,
  appUid: env.APP_UID,
  secretKey: env.APP_SECRET_KEY,
  appBaseUrl: env.APP_BASE_URL,
  descriptorVendorApiBaseUrl: env.DESCRIPTOR_VENDOR_API_BASE_URL ?? env.APP_BASE_URL,
  moyskladVendorApiEndpointUrl: env.MOYSKLAD_VENDOR_API_ENDPOINT_URL,
  moyskladJsonApiEndpointUrl: env.MOYSKLAD_JSON_API_ENDPOINT_URL,
  httpTimeoutMs: env.HTTP_TIMEOUT_MS,
  httpMaxRetries: env.HTTP_MAX_RETRIES,
  httpRetryBaseMs: env.HTTP_RETRY_BASE_MS,
  sessionSecret: env.SESSION_SECRET,
  sessionCookieSecure: env.SESSION_COOKIE_SECURE,
  sessionCookieSameSite: env.SESSION_COOKIE_SAME_SITE,
  sessionName: env.SESSION_NAME,
  sessionDir: env.SESSION_DIR,
  trustProxy: env.TRUST_PROXY,
  dataDir: env.DATA_DIR
});

export function cfg(): AppConfig {
  return config;
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
