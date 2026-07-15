import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { IncomingHttpHeaders } from "node:http";
import { config } from "../config/config";
import { makeHttpRequest } from "../http/http-client";
import { logMessage } from "../observability/logger";
import { JwtReplay } from "../security/jwt-replay-repository";
import type {
  VendorApiContextResponse,
  VendorApiLoyaltyData,
  VendorApiLoyaltyPatch,
  VendorApiStatusResponse
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

    if (typeof decoded.iat !== "number") {
      logMessage("WARN", "JWT iat is not set");
      return false;
    }

    const effectiveExp = typeof decoded.exp === "number" ? decoded.exp : decoded.iat + 300;
    if (!JwtReplay.register(String(decoded.jti), effectiveExp)) {
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

  async updateLoyaltySettings(appId: string, accountId: string, data: VendorApiLoyaltyData): Promise<boolean> {
    return this.updateLoyalty("PUT", appId, accountId, data);
  }

  async updateLoyaltySettingsPartially(appId: string, accountId: string, data: VendorApiLoyaltyPatch): Promise<boolean> {
    return this.updateLoyalty("PATCH", appId, accountId, data);
  }

  private async updateLoyalty(
    method: "PUT" | "PATCH",
    appId: string,
    accountId: string,
    data: VendorApiLoyaltyData | VendorApiLoyaltyPatch
  ): Promise<boolean> {
    const result = await makeHttpRequest<Record<string, never>>(
      method,
      `${config.moyskladVendorApiEndpointUrl}/apps/${appId}/${accountId}/loyalty`,
      buildVendorApiJwt(),
      data,
      {
        serviceName: "vendor-api",
        retryable: false,
        allowEmptySuccessResponse: true
      }
    );

    return result !== null;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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
