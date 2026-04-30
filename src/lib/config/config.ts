import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type SessionCookieSameSite = "lax" | "strict" | "none";

export class AppConfig {
  appId = "";
  appUid = "";
  secretKey = "";
  appBaseUrl = "http://localhost:3000";
  moyskladVendorApiEndpointUrl = "https://apps-api.moysklad.ru/api/vendor/1.0";
  moyskladJsonApiEndpointUrl = "https://api.moysklad.ru/api/remap/1.2";
  port = 3000;
  logLevel: LogLevel = "DEBUG";
  // Секрет для подписи server-side сессий; задавайте случайное значение длиной не менее 32 символов.
  sessionSecret = "";
  sessionCookieSecure = true;
  sessionCookieSameSite: SessionCookieSameSite = "none";
  sessionName = "connect.sid";
  // Директория для хранения состояния сессий (в текущей реализации — файловый store).
  sessionDir = path.resolve(process.cwd(), "./tmp/data/sessions");
  // Включает режим trust proxy в Express при работе за ingress/reverse proxy.
  trustProxy = 1;
  // Базовая директория для runtime-данных приложения (сессии, jti-маркеры и т.д.).
  dataDir = path.resolve(process.cwd(), "./tmp/data");
}

export const config = fromEnv(process.env);

function fromEnv(env: NodeJS.ProcessEnv): AppConfig {
  const next = new AppConfig();

  next.port = env.PORT ? Number(env.PORT) : next.port;
  next.logLevel = (env.LOG_LEVEL as LogLevel | undefined) ?? next.logLevel;

  next.appId = env.APP_ID ?? next.appId;
  next.appUid = env.APP_UID ?? next.appUid;
  next.secretKey = env.APP_SECRET_KEY ?? next.secretKey;
  next.appBaseUrl = env.APP_BASE_URL ?? next.appBaseUrl;

  next.moyskladVendorApiEndpointUrl = env.MOYSKLAD_VENDOR_API_ENDPOINT_URL ?? next.moyskladVendorApiEndpointUrl;
  next.moyskladJsonApiEndpointUrl = env.MOYSKLAD_JSON_API_ENDPOINT_URL ?? next.moyskladJsonApiEndpointUrl;

  next.sessionSecret = env.SESSION_SECRET ?? next.sessionSecret;
  next.sessionCookieSecure = env.SESSION_COOKIE_SECURE === undefined
    ? next.sessionCookieSecure
    : env.SESSION_COOKIE_SECURE === "true";
  next.sessionCookieSameSite = (env.SESSION_COOKIE_SAME_SITE as SessionCookieSameSite | undefined)
    ?? next.sessionCookieSameSite;
  next.sessionName = env.SESSION_NAME ?? next.sessionName;

  next.sessionDir = env.SESSION_DIR ? path.resolve(process.cwd(), env.SESSION_DIR) : next.sessionDir;
  next.trustProxy = env.TRUST_PROXY !== undefined ? Number(env.TRUST_PROXY) : next.trustProxy;
  next.dataDir = env.DATA_DIR ? path.resolve(process.cwd(), env.DATA_DIR) : next.dataDir;

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

  if (!config.sessionSecret) {
    missing.push("SESSION_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required runtime config: ${missing.join(", ")}`);
  }
}
