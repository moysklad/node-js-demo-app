import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("DEBUG"),
  APP_ID: z.string().default(""),
  APP_UID: z.string().default(""),
  APP_SECRET_KEY: z.string().default(""),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  DESCRIPTOR_VENDOR_API_BASE_URL: z.url().optional(),
  MOYSKLAD_VENDOR_API_ENDPOINT_URL: z.url().default("https://apps-api.moysklad.ru/api/vendor/1.0"),
  MOYSKLAD_JSON_API_ENDPOINT_URL: z.url().default("https://api.moysklad.ru/api/remap/1.2"),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  HTTP_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  HTTP_RETRY_BASE_MS: z.coerce.number().int().min(10).default(250),
  SESSION_SECRET: z.string().default("change-me"),
  SESSION_COOKIE_SECURE: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("none"),
  SESSION_NAME: z.string().default("connect.sid"),
  SESSION_DIR: z.string().default("./tmp/data/sessions"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  DATA_DIR: z.string().default("./tmp/data")
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
  sessionDir = path.resolve(process.cwd(), "./tmp/data/sessions");
  trustProxy = 1;
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
        this.sessionCookieSecure = Boolean(value);
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
        (this as Record<string, unknown>)[key] = "";
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
