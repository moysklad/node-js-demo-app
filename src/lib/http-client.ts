import axios, { AxiosError, type AxiosRequestConfig, type Method } from "axios";
import { cfg } from "./config";
import { logMessage } from "./logger";
import { redactSensitiveValue } from "./security";

export type HttpErrorKind = "transport" | "http" | "decode";

class HttpRequestError extends Error {
  kind: HttpErrorKind;
  method: Method;
  url: string;
  status?: number;
  attempt: number;
  durationMs: number;

  constructor(params: {
    kind: HttpErrorKind;
    method: Method;
    url: string;
    message: string;
    status?: number;
    attempt: number;
    durationMs: number;
  }) {
    super(params.message);
    this.name = "HttpRequestError";
    this.kind = params.kind;
    this.method = params.method;
    this.url = params.url;
    this.status = params.status;
    this.attempt = params.attempt;
    this.durationMs = params.durationMs;
  }
}

export type HttpRequestOptions = {
  retryable?: boolean;
  serviceName?: string;
  allowEmptySuccessResponse?: boolean;
};

const MAX_LOGGED_RESPONSE_BODY_CHARS = 2000;

export async function makeHttpRequest<T>(
  method: Method,
  url: string,
  bearerToken: string,
  data: unknown = null,
  options: HttpRequestOptions = {}
): Promise<T | null> {
  try {
    return await makeHttpRequestDetailed<T>(method, url, bearerToken, data, options);
  } catch {
    return null;
  }
}

async function makeHttpRequestDetailed<T>(
  method: Method,
  url: string,
  bearerToken: string,
  data: unknown = null,
  options: HttpRequestOptions = {}
): Promise<T | null> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearerToken}`,
    "Accept-Encoding": "gzip"
  };

  if (data !== null) {
    headers["Content-Type"] = "application/json";
  }

  logMessage("DEBUG", `Request: ${method} ${url}`, {
    service: options.serviceName ?? "external-api",
    headers: redactSensitiveValue(headers) as Record<string, unknown>,
    body: redactSensitiveValue(data)
  });

  const requestConfig: AxiosRequestConfig = {
    method,
    url,
    headers,
    data,
    timeout: cfg().httpTimeoutMs,
    maxRedirects: 10,
    decompress: true,
    validateStatus: () => true,
    transitional: {
      silentJSONParsing: false
    },
    responseType: "text"
  };

  const maxAttempts = (options.retryable ?? isRetryableMethod(method)) ? cfg().httpMaxRetries + 1 : 1;
  let attempt = 0;
  let lastError: HttpRequestError | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const startedAt = Date.now();

    try {
      const response = await axios(requestConfig);
      const durationMs = Date.now() - startedAt;

      logMessage(
        "DEBUG",
        `Response: ${method} ${url}`,
        {
          service: options.serviceName ?? "external-api",
          status: response.status,
          attempt,
          durationMs,
          headers: redactSensitiveValue(response.headers) as Record<string, unknown>,
          body: sanitizeResponseBodyForLog(response.data)
        }
      );

      if (response.status >= 400) {
        const error = new HttpRequestError({
          kind: "http",
          method,
          url,
          status: response.status,
          attempt,
          durationMs,
          message: `HTTP ${response.status} for ${method} ${url}`
        });

        logMessage("WARN", error.message, {
          service: options.serviceName ?? "external-api",
          kind: error.kind,
          status: error.status,
          attempt,
          durationMs
        });

        if (shouldRetryHttpStatus(response.status) && attempt < maxAttempts) {
          await waitWithBackoff(attempt);
          continue;
        }

        throw error;
      }

      const body = String(response.data ?? "");
      if (body === "") {
        if (options.allowEmptySuccessResponse) {
          return {} as T;
        }

        return null;
      }

      try {
        return JSON.parse(body) as T;
      } catch (error) {
        const decodeError = new HttpRequestError({
          kind: "decode",
          method,
          url,
          attempt,
          durationMs,
          message: `Failed to decode JSON for ${method} ${url}: ${error instanceof Error ? error.message : String(error)}`
        });

        logMessage("WARN", decodeError.message, {
          service: options.serviceName ?? "external-api",
          kind: decodeError.kind,
          attempt,
          durationMs
        });
        throw decodeError;
      }
    } catch (error) {
      if (error instanceof HttpRequestError) {
        lastError = error;
      } else {
        const durationMs = Date.now() - startedAt;
        const transportError = new HttpRequestError({
          kind: "transport",
          method,
          url,
          attempt,
          durationMs,
          message: buildTransportErrorMessage(error, method, url)
        });

        logMessage("ERROR", transportError.message, {
          service: options.serviceName ?? "external-api",
          kind: transportError.kind,
          attempt,
          durationMs
        });
        lastError = transportError;
      }

      if (lastError.kind === "transport" && attempt < maxAttempts) {
        await waitWithBackoff(attempt);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error(`Unknown HTTP client failure for ${method} ${url}`);
}

function isRetryableMethod(method: Method): boolean {
  const normalized = String(method).toUpperCase();
  return normalized === "GET" || normalized === "PUT" || normalized === "DELETE";
}

function shouldRetryHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function buildTransportErrorMessage(error: unknown, method: Method, url: string): string {
  if (error instanceof AxiosError) {
    return `Transport error for ${method} ${url}: ${error.code ?? error.message}`;
  }

  return `Transport error for ${method} ${url}: ${error instanceof Error ? error.message : String(error)}`;
}

async function waitWithBackoff(attempt: number): Promise<void> {
  const delayMs = cfg().httpRetryBaseMs * Math.max(1, attempt);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function sanitizeResponseBodyForLog(body: unknown): unknown {
  if (typeof body !== "string") {
    return redactSensitiveValue(body);
  }

  if (body === "") {
    return "";
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    const redacted = redactSensitiveValue(parsed);
    const serialized = JSON.stringify(redacted);
    return truncateLogText(serialized);
  } catch {
    return truncateLogText(body);
  }
}

function truncateLogText(value: string): string {
  if (value.length <= MAX_LOGGED_RESPONSE_BODY_CHARS) {
    return value;
  }

  return `${value.slice(0, MAX_LOGGED_RESPONSE_BODY_CHARS)}... [truncated ${value.length - MAX_LOGGED_RESPONSE_BODY_CHARS} chars]`;
}
