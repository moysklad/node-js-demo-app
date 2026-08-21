import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { IncomingHttpHeaders } from "node:http";
import { config } from "../config/config";
import { makeHttpRequest, makeHttpRequestResult } from "../http/http-client";
import { logMessage } from "../observability/logger";
import { JwtReplay } from "../security/jwt-replay-repository";
import type {
  UserContextExchangeResult,
  VendorApiContextResponse,
  VendorApiStatusResponse,
  VendorApiUserContext
} from "../domain/types";

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

// Достаёт код ошибки Zeus (_3007/_3008) из тела ответа: {"errors":[{"code":3007}]} или {"code":3007}.
function parseZeusErrorCode(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as { errors?: Array<{ code?: unknown }>; code?: unknown };

    if (Array.isArray(parsed.errors) && parsed.errors[0]?.code != null) {
      return String(parsed.errors[0].code);
    }

    if (parsed.code != null) {
      return String(parsed.code);
    }
  } catch {
    // тело не JSON — кода нет
  }

  return null;
}

export class VendorApi {
  async context(contextKey: string): Promise<VendorApiContextResponse | null> {
    return this.request<VendorApiContextResponse>("POST", `/context/${contextKey}`, {});
  }

  async exchangeUserContext(token: string): Promise<UserContextExchangeResult<VendorApiUserContext>> {
    return this.exchangeUserContextToken<VendorApiUserContext>("/context/user", token);
  }

  async expandUserContext(token: string): Promise<UserContextExchangeResult<VendorApiContextResponse>> {
    return this.exchangeUserContextToken<VendorApiContextResponse>("/context/user/expand", token);
  }

  private async exchangeUserContextToken<T>(
    path: string,
    token: string
  ): Promise<UserContextExchangeResult<T>> {
    const result = await makeHttpRequestResult<T>(
      "POST",
      `${config.moyskladVendorApiEndpointUrl}${path}`,
      buildVendorApiJwt(),
      { token },
      { serviceName: "vendor-api", retryable: false }
    );

    if (result.ok && result.data) {
      return { ok: true, data: result.data };
    }

    return { ok: false, status: result.status, errorCode: parseZeusErrorCode(result.rawBody) };
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

  private async request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body: unknown = null): Promise<T | null> {
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
