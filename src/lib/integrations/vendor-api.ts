import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { IncomingHttpHeaders } from "node:http";
import { config } from "../config/config";
import { makeHttpRequest, makeHttpRequestDetailed, type HttpFailure } from "../http/http-client";
import { logMessage } from "../observability/logger";
import { JwtReplay } from "../security/jwt-replay-repository";
import type {
  VendorApiContextResponse,
  VendorApiLoyaltyData,
  VendorApiStatusResponse
} from "../domain/types";

/**
 * Ошибка Vendor API в документированном формате: {"errors": [{"error": "...", "code": 2006}]}.
 */
type VendorApiErrorBody = {
  errors?: Array<{ error?: string; code?: number; parameter?: string }>;
};

export type VendorApiCallResult = {
  ok: boolean;
  error?: { code: number | null; message: string };
};

/**
 * Достает из отказа причину, понятную пользователю решения.
 * Общее «не удалось» вынуждает вендора искать проблему вслепую, поэтому показываем,
 * что именно ответил МойСклад, и подсказываем частые причины.
 */
function describeVendorApiFailure(failure: HttpFailure | null): { code: number | null; message: string } {
  if (!failure) {
    return { code: null, message: "МойСклад вернул неожиданный ответ" };
  }

  if (failure.kind === "transport") {
    return { code: null, message: `Не удалось обратиться к Vendor API: ${failure.message}` };
  }

  const body = parseVendorApiErrorBody(failure.body);
  const first = body?.errors?.[0];

  if (!first?.error) {
    return { code: null, message: `Vendor API ответил статусом ${failure.status ?? "?"}` };
  }

  const code = typeof first.code === "number" ? first.code : null;
  const hint = vendorApiErrorHint(code);

  return { code, message: hint ? `${first.error}. ${hint}` : first.error };
}

function vendorApiErrorHint(code: number | null): string | null {
  switch (code) {
    case 2004:
      return "Проверьте, что решение установлено на этом аккаунте и APP_ID совпадает с решением в кабинете вендора";
    case 2006:
      return "Добавьте элемент <loyaltyApi/> в дескриптор решения в кабинете вендора";
    case 2007:
      return "Дождитесь, пока решение завершит установку, и повторите попытку";
    default:
      return null;
  }
}

function parseVendorApiErrorBody(body: unknown): VendorApiErrorBody | null {
  if (body && typeof body === "object") {
    return body as VendorApiErrorBody;
  }

  if (typeof body !== "string" || body.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(body) as VendorApiErrorBody;
  } catch {
    return null;
  }
}

export function buildVendorApiJwt(): string {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      sub: config.appUid,
      iat: now,
      exp: now + 300,
      jti: crypto.randomBytes(32).toString("hex")
    },
    config.secretKey,
    { algorithm: "HS256" }
  );
}

export function authTokenIsValid(headers: IncomingHttpHeaders): boolean {
  const rawAuth = headers.authorization;
  const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

  if (!auth) {
    logMessage("WARN", "Authorization header not set");
    return false;
  }

  const bearer = "Bearer ";

  if (!auth.startsWith(bearer)) {
    logMessage("WARN", "Invalid Authorization header format");
    return false;
  }

  const jwtToken = auth.slice(bearer.length);
  const secretKey = config.secretKey;

  if (!secretKey) {
    logMessage("ERROR", "Secret key is not set in config");
    return false;
  }

  try {
    const decoded = jwt.verify(jwtToken, secretKey, { algorithms: ["HS256"] }) as jwt.JwtPayload;

    if (!decoded.jti) {
      logMessage("WARN", "JTI is not set");
      return false;
    }

    if (decoded.exp == null) {
      logMessage("WARN", "JWT exp is not set");
      return false;
    }

    if (decoded.iat == null) {
      logMessage("WARN", "JWT iat is not set");
      return false;
    }

    if (!JwtReplay.register(String(decoded.jti), decoded.exp)) {
      logMessage("WARN", "JWT replay detected", { jti: String(decoded.jti) });
      return false;
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logMessage("WARN", message);
    return false;
  }
}

export class VendorApi {
  async context(contextKey: string): Promise<VendorApiContextResponse | null> {
    return this.request<VendorApiContextResponse>("POST", `/context/${contextKey}`, {});
  }

  async updateAppStatus(
    appId: string,
    accountId: string,
    status: string
  ): Promise<VendorApiStatusResponse | null> {
    return makeHttpRequest<VendorApiStatusResponse>(
      "PUT",
      `${config.moyskladVendorApiEndpointUrl}/apps/${appId}/${accountId}/status`,
      buildVendorApiJwt(),
      { status },
      {
        serviceName: "vendor-api",
        retryable: true,
        allowEmptySuccessResponse: true
      }
    );
  }

  async updateLoyaltySettings(
    appId: string,
    accountId: string,
    data: VendorApiLoyaltyData
  ): Promise<VendorApiCallResult> {
    const result = await makeHttpRequestDetailed<Record<string, never>>(
      "PUT",
      `${config.moyskladVendorApiEndpointUrl}/apps/${appId}/${accountId}/loyalty`,
      buildVendorApiJwt(),
      data,
      {
        serviceName: "vendor-api",
        retryable: false,
        allowEmptySuccessResponse: true
      }
    );

    if (result.data !== null) {
      return { ok: true };
    }

    return { ok: false, error: describeVendorApiFailure(result.failure) };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body: unknown = null
  ): Promise<T | null> {
    return makeHttpRequest<T>(
      method,
      `${config.moyskladVendorApiEndpointUrl}${path}`,
      buildVendorApiJwt(),
      body,
      { serviceName: "vendor-api", retryable: method !== "POST" }
    );
  }
}

let vendorApiInstance: VendorApi = new VendorApi();

export function vendorApi(): VendorApi {
  return vendorApiInstance;
}
