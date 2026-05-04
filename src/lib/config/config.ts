import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type SessionCookieSameSite = "lax" | "strict" | "none";

export class AppConfig {
  appId = "";
  appUid = "";
  secretKey = "";
  // Ключ шифрования чувствительных данных в SQLite; задавайте случайное шестнадцатеричное значение длиной ровно 64 символа.
  encryptKey = "";
  appBaseUrl = "http://localhost:3000";
  moyskladVendorApiEndpointUrl = "https://apps-api.moysklad.ru/api/vendor/1.0";
  moyskladJsonApiEndpointUrl = "https://api.moysklad.ru/api/remap/1.2";
  port = 3000;
  logLevel: LogLevel = "DEBUG";
  // Секрет для подписи серверных сессий; задавайте случайное значение длиной не менее 32 символов.
  sessionSecret = "";
  sessionCookieSecure = true;
  sessionCookieSameSite: SessionCookieSameSite = "none";
  sessionName = "connect.sid";
  // Включает режим trust proxy в Express при работе за ingress/reverse-proxy.
  trustProxy = 1;
  // Базовая директория для данных времени выполнения приложения (SQLite-файл, jti-маркеры и т.д.).
  dataDir = path.resolve(process.cwd(), "./tmp/data");
  // SQLite-файл для хранения состояния приложения и серверных сессий.
  appDbPath = path.resolve(process.cwd(), "./tmp/data/app.sqlite");
}

export const config = fromEnv(process.env);

function fromEnv(env: NodeJS.ProcessEnv): AppConfig {
  const next = new AppConfig();

  next.port = env.PORT ? Number(env.PORT) : next.port;
  next.logLevel = (env.LOG_LEVEL as LogLevel | undefined) ?? next.logLevel;

  next.appId = env.APP_ID ?? next.appId;
  next.appUid = env.APP_UID ?? next.appUid;
  next.secretKey = env.APP_SECRET_KEY ?? next.secretKey;
  next.encryptKey = env.APP_ENCRYPT_KEY ?? next.encryptKey;
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

  next.trustProxy = env.TRUST_PROXY !== undefined ? Number(env.TRUST_PROXY) : next.trustProxy;
  next.dataDir = env.DATA_DIR ? path.resolve(process.cwd(), env.DATA_DIR) : next.dataDir;
  next.appDbPath = env.APP_DB_PATH ? path.resolve(process.cwd(), env.APP_DB_PATH) : next.appDbPath;

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

  if (!config.encryptKey) {
    missing.push("APP_ENCRYPT_KEY");
  }

  if (!config.sessionSecret) {
    missing.push("SESSION_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required runtime config: ${missing.join(", ")}`);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(config.encryptKey)) {
    throw new Error("APP_ENCRYPT_KEY must be 64 hex characters");
  }
}
