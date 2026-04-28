import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { IncomingHttpHeaders } from "node:http";
import { cfg } from "../config/config";
import { makeHttpRequest } from "../http/http-client";
import { logMessage } from "../observability/logger";
import { isJwtJtiReplay, rememberJwtJti } from "../security/security";
import type { VendorApiContextResponse, VendorApiStatusResponse } from "../domain/types";

// Максимально допустимый lifetime JWT (секунды) для входящих запросов от МС.
const JWT_MAX_LIFETIME_SECONDS = 5 * 60;
// Допустимое расхождение часов между сервисами (секунды).
const JWT_CLOCK_SKEW_SECONDS = 30;

export function buildVendorApiJwt(): string {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      sub: cfg().appUid,
      iat: now,
      exp: now + 300,
      jti: crypto.randomBytes(32).toString("hex")
    },
    cfg().secretKey,
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
    logMessage("WARN", `Invalid auth token: ${auth}`);
    return false;
  }

  const jwtToken = auth.slice(bearer.length);
  const secretKey = cfg().secretKey;

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

    if (!isTimestampInAllowedWindow(decoded.iat, decoded.exp)) {
      logMessage("WARN", "JWT iat/exp are outside allowed time window", { iat: decoded.iat, exp: decoded.exp });
      return false;
    }

    if (isJwtJtiReplay(String(decoded.jti))) {
      logMessage("WARN", "JWT replay detected", { jti: String(decoded.jti) });
      return false;
    }

    rememberJwtJti(String(decoded.jti), decoded.exp);

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
      `${cfg().moyskladVendorApiEndpointUrl}/apps/${appId}/${accountId}/status`,
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
      `${cfg().moyskladVendorApiEndpointUrl}${path}`,
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

function isTimestampInAllowedWindow(iatRaw: unknown, expRaw: unknown): boolean {
  if (typeof iatRaw !== "number" || !Number.isFinite(iatRaw)) {
    return false;
  }

  if (typeof expRaw !== "number" || !Number.isFinite(expRaw)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const iat = Math.floor(iatRaw);
  const exp = Math.floor(expRaw);

  if (iat > now + JWT_CLOCK_SKEW_SECONDS) {
    return false;
  }

  if (exp < now - JWT_CLOCK_SKEW_SECONDS) {
    return false;
  }

  if (exp <= iat) {
    return false;
  }

  if (exp - iat > JWT_MAX_LIFETIME_SECONDS + JWT_CLOCK_SKEW_SECONDS) {
    return false;
  }

  return true;
}
