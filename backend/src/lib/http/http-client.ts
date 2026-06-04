import axios, { AxiosError, type AxiosRequestConfig, type Method } from "axios";
import axiosRetry from "axios-retry";
import { logMessage } from "../observability/logger";

export type HttpRequestOptions = {
  retryable?: boolean;
  serviceName?: string;
  allowEmptySuccessResponse?: boolean;
};

const MAX_LOGGED_RESPONSE_BODY_CHARS = 2000;
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
const DEFAULT_HTTP_MAX_RETRIES = 2;
const DEFAULT_HTTP_RETRY_BASE_MS = 250;
const LOGNEX_RETRY_AFTER_HEADER = "x-lognex-retry-after";

const httpClient = axios.create();

// Подключаем axios-retry к инстансу; фактическая политика повторов задается ниже для каждого запроса.
axiosRetry(httpClient, {
  retries: 0,
  shouldResetTimeout: true
});

export async function makeHttpRequest<T>(
  method: Method,
  url: string,
  bearerToken: string,
  data: unknown = null,
  options: HttpRequestOptions = {}
): Promise<T | null> {
  return makeHttpRequestDetailed<T>(method, url, bearerToken, data, options);
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
    headers,
    body: data
  });

  const requestConfig: AxiosRequestConfig = {
    method,
    url,
    headers,
    data,
    timeout: DEFAULT_HTTP_TIMEOUT_MS,
    maxRedirects: 10,
    decompress: true,
    transitional: {
      silentJSONParsing: false
    },
    responseType: "text"
  };

  const retryEnabled = options.retryable ?? isRetryableMethod(method);
  const retries = retryEnabled ? DEFAULT_HTTP_MAX_RETRIES : 0;
  requestConfig["axios-retry"] = {
    retries,
    retryDelay: (retryCount: number, error: AxiosError) =>
      resolveRetryDelayMs(error) ?? DEFAULT_HTTP_RETRY_BASE_MS * Math.max(1, retryCount),
    retryCondition: (error: AxiosError) => {
      if (error.response?.status != null) {
        return shouldRetryHttpStatus(error.response.status);
      }
      return true;
    },
    onRetry: (retryCount: number, error: AxiosError) => {
      logMessage("WARN", `Retry attempt ${retryCount + 1} for ${method} ${url}`, {
        service: options.serviceName ?? "external-api",
        status: error.response?.status,
        code: error.code
      });
    }
  };

  const startedAt = Date.now();

  try {
    const response = await httpClient(requestConfig);
    const durationMs = Date.now() - startedAt;
    const attempt = getAttemptFromAxiosConfig(response.config);

    logHttpResponse("DEBUG", method, url, options.serviceName, response.status, attempt, durationMs, response.headers, response.data);

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
      const message = `Failed to decode JSON for ${method} ${url}: ${error instanceof Error ? error.message : String(error)}`;

      logMessage("WARN", message, {
        service: options.serviceName ?? "external-api",
        kind: "decode",
        attempt,
        durationMs
      });
      return null;
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const axiosError = error as AxiosError;
    const attempt = getAttemptFromAxiosConfig(axiosError.config);

    if (axiosError.response) {
      logHttpResponse(
        "DEBUG",
        method,
        url,
        options.serviceName,
        axiosError.response.status,
        attempt,
        durationMs,
        axiosError.response.headers,
        axiosError.response.data
      );

      const message = `HTTP ${axiosError.response.status} for ${method} ${url}`;

      logMessage("WARN", message, {
        service: options.serviceName ?? "external-api",
        kind: "http",
        status: axiosError.response.status,
        attempt,
        durationMs
      });
      return null;
    }

    const message = buildTransportErrorMessage(error, method, url);

    logMessage("ERROR", message, {
      service: options.serviceName ?? "external-api",
      kind: "transport",
      attempt,
      durationMs
    });
    return null;
  }
}

function isRetryableMethod(method: Method): boolean {
  const normalized = String(method).toUpperCase();
  return normalized === "GET" || normalized === "PUT" || normalized === "DELETE";
}

function shouldRetryHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function resolveRetryDelayMs(error: AxiosError): number | null {
  const rawRetryAfter = getHeaderValue(error.response?.headers, LOGNEX_RETRY_AFTER_HEADER);

  if (rawRetryAfter == null) {
    return null;
  }

  const retryAfterMs = Number.parseInt(rawRetryAfter, 10);

  if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
    return null;
  }

  return retryAfterMs;
}

function getHeaderValue(headers: unknown, headerName: string): string | null {
  if (!headers || typeof headers !== "object") {
    return null;
  }

  const normalizedHeaderName = headerName.toLowerCase();

  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    if (name.toLowerCase() !== normalizedHeaderName) {
      continue;
    }

    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }

  return null;
}

function buildTransportErrorMessage(error: unknown, method: Method, url: string): string {
  if (error instanceof AxiosError) {
    return `Transport error for ${method} ${url}: ${error.code ?? error.message}`;
  }

  return `Transport error for ${method} ${url}: ${error instanceof Error ? error.message : String(error)}`;
}

function sanitizeResponseBodyForLog(body: unknown): unknown {
  if (typeof body !== "string") {
    return body;
  }

  if (body === "") {
    return "";
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    const serialized = JSON.stringify(parsed);
    return truncateLogText(serialized);
  } catch {
    return truncateLogText(body);
  }
}

function getAttemptFromAxiosConfig(config: unknown): number {
  if (!config || typeof config !== "object") {
    return 1;
  }

  const retryMeta = (config as Record<string, unknown>)["axios-retry"];
  if (!retryMeta || typeof retryMeta !== "object") {
    return 1;
  }

  const retryCount = (retryMeta as Record<string, unknown>).retryCount;
  return typeof retryCount === "number" ? retryCount + 1 : 1;
}

function logHttpResponse(
  level: "DEBUG" | "INFO" | "WARN" | "ERROR",
  method: Method,
  url: string,
  serviceName: string | undefined,
  status: number,
  attempt: number,
  durationMs: number,
  headers: unknown,
  body: unknown
): void {
  logMessage(level, `Response: ${method} ${url}`, {
    service: serviceName ?? "external-api",
    status,
    attempt,
    durationMs,
    headers: headers as Record<string, unknown>,
    body: sanitizeResponseBodyForLog(body)
  });
}

function truncateLogText(value: string): string {
  if (value.length <= MAX_LOGGED_RESPONSE_BODY_CHARS) {
    return value;
  }

  return `${value.slice(0, MAX_LOGGED_RESPONSE_BODY_CHARS)}... [truncated ${value.length - MAX_LOGGED_RESPONSE_BODY_CHARS} chars]`;
}
