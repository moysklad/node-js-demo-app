import dotenv from "dotenv";

dotenv.config({ quiet: true });

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const DB_SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

type SessionCookieSameSite = "lax" | "strict" | "none";

export class AppConfig {
  appId = "";
  appUid = "";
  secretKey = "";
  // Ключ шифрования чувствительных данных в базе; задавайте случайное шестнадцатеричное значение длиной ровно 64 символа.
  encryptKey = "";
  appBaseUrl = "http://localhost:3000";
  moyskladVendorApiEndpointUrl = "https://apps-api.moysklad.ru/api/vendor/1.0";
  moyskladJsonApiEndpointUrl = "https://api.moysklad.ru/api/remap/1.2";
  port = 3000;
  logLevel: LogLevel = "INFO";
  // Секрет для подписи серверных сессий; задавайте случайное значение длиной не менее 32 символов.
  sessionSecret = "";
  sessionCookieSecure = true;
  sessionCookieSameSite: SessionCookieSameSite = "none";
  sessionName = "connect.sid";
  // Включает режим trust proxy в Express при работе за ingress/reverse-proxy.
  trustProxy = 1;
  // PostgreSQL с состоянием приложения, серверными сессиями и replay-маркерами JWT.
  dbHost = "";
  dbPort = 5432;
  dbName = "";
  dbUser = "";
  dbPassword = "";
  // Схема, в которой решение хранит свои таблицы: несколько решений могут делить одну базу.
  dbSchema = "public";
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
  next.dbHost = env.APP_DB_HOST?.trim() ?? next.dbHost;
  next.dbPort = env.APP_DB_PORT ? Number(env.APP_DB_PORT) : next.dbPort;
  next.dbName = env.APP_DB_NAME?.trim() ?? next.dbName;
  next.dbUser = env.APP_DB_USER?.trim() ?? next.dbUser;
  next.dbPassword = env.APP_DB_PASSWORD ?? next.dbPassword;
  next.dbSchema = env.APP_DB_SCHEMA?.trim() || next.dbSchema;

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

  if (!config.dbHost) {
    missing.push("APP_DB_HOST");
  }

  if (!config.dbName) {
    missing.push("APP_DB_NAME");
  }

  if (!config.dbUser) {
    missing.push("APP_DB_USER");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required runtime config: ${missing.join(", ")}`);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(config.encryptKey)) {
    throw new Error("APP_ENCRYPT_KEY must be 64 hex characters");
  }

  if (!DB_SCHEMA_PATTERN.test(config.dbSchema)) {
    throw new Error("APP_DB_SCHEMA must be a lowercase identifier: letters, digits and underscores");
  }
}
