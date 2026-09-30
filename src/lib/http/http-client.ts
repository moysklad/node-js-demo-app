import { createHash } from "node:crypto";
import axios, { AxiosError, type AxiosRequestConfig, type Method } from "axios";
import axiosRetry from "axios-retry";
import { logMessage } from "../observability/logger";

export type HttpRequestOptions = {
  retryable?: boolean;
  serviceName?: string;
  allowEmptySuccessResponse?: boolean;
  logBody?: boolean;
};

/**
 * Причина отказа запроса. Нужна, когда вызывающему коду мало факта неудачи:
 * например, чтобы показать пользователю ошибку внешнего API, а не общее сообщение.
 */
export type HttpFailure = {
  kind: "http" | "transport" | "decode";
  status: number | null;
  body: unknown;
  message: string;
};

export type HttpResult<T> = {
  data: T | null;
  failure: HttpFailure | null;
  /** Сколько раз запрос повторялся из-за 429 с заголовком X-Lognex-Retry-After. */
  retries: number;
};

const MAX_LOGGED_RESPONSE_BODY_CHARS = 2000;
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
// JSON API ограничивает и частоту, и число параллельных запросов; серии запросов нужен
// запас повторов, чтобы дождаться следующего окна, а не отвалиться после пары ожиданий.
const DEFAULT_HTTP_MAX_RETRIES = 10;
const DEFAULT_HTTP_RETRY_BASE_MS = 250;
const LOGNEX_RETRY_AFTER_HEADER = "x-lognex-retry-after";
const LOGNEX_RETRY_INTERVAL_HEADER = "x-lognex-retry-timeinterval";
const RATE_LIMIT_HEADER = "x-ratelimit-limit";
const JSON_API_SERVICE_NAME = "json-api";
const RATE_LIMIT_GATE_IDLE_MS = 10 * 60 * 1000;

class LognexRateLimitGate {
  private notBefore = 0;
  private spacingMs = 0;
  private lastUsedAt = Date.now();

  async reserve(): Promise<void> {
    const delayMs = this.reserveDelay(0);

    if (delayMs > 0) {
      await delay(delayMs);
    }
  }

  reserveDelay(minimumDelayMs: number): number {
    const now = Date.now();
    this.lastUsedAt = now;
    const startAt = Math.max(now + minimumDelayMs, this.notBefore);
    this.notBefore = startAt + this.spacingMs;
    return startAt - now;
  }

  observe(status: number, headers: unknown): number | null {
    this.lastUsedAt = Date.now();
    const limit = getNonNegativeIntegerHeader(headers, RATE_LIMIT_HEADER);
    const intervalMs = getNonNegativeIntegerHeader(headers, LOGNEX_RETRY_INTERVAL_HEADER);

    if (limit != null && limit > 0 && intervalMs != null && intervalMs > 0) {
      this.spacingMs = intervalMs / limit;
    }

    if (status !== 429) {
      return null;
    }

    const retryAfterMs = getNonNegativeIntegerHeader(headers, LOGNEX_RETRY_AFTER_HEADER);

    if (retryAfterMs != null) {
      this.notBefore = Math.max(this.notBefore, Date.now() + retryAfterMs);
    }

    return retryAfterMs;
  }

  isIdleSince(idleBefore: number): boolean {
    return this.lastUsedAt <= idleBefore;
  }
}

const rateLimitGates = new Map<string, LognexRateLimitGate>();

function getRateLimitGate(serviceName: string, bearerToken: string): LognexRateLimitGate | null {
  if (serviceName !== JSON_API_SERVICE_NAME) {
    return null;
  }

  evictIdleRateLimitGates();
  const key = createHash("sha256").update(bearerToken).digest("hex");
  let gate = rateLimitGates.get(key);

  if (gate) {
    return gate;
  }

  gate = new LognexRateLimitGate();
  rateLimitGates.set(key, gate);
  return gate;
}

function evictIdleRateLimitGates(): void {
  const idleBefore = Date.now() - RATE_LIMIT_GATE_IDLE_MS;

  for (const [key, gate] of rateLimitGates) {
    if (gate.isIdleSince(idleBefore)) {
      rateLimitGates.delete(key);
    }
  }
}

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
  const result = await makeHttpRequestDetailed<T>(method, url, bearerToken, data, options);

  return result.data;
}

export async function makeHttpRequestDetailed<T>(
  method: Method,
  url: string,
  bearerToken: string,
  data: unknown = null,
  options: HttpRequestOptions = {}
): Promise<HttpResult<T>> {
  const serviceName = options.serviceName ?? "external-api";
  const gate = getRateLimitGate(serviceName, bearerToken);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearerToken}`,
    "Accept-Encoding": "gzip"
  };

  if (data !== null) {
    headers["Content-Type"] = "application/json";
  }

  logMessage("DEBUG", `Request: ${method} ${url}`, {
    service: serviceName,
    headers,
    ...(options.logBody === false ? {} : { body: data })
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
  let lognexRetries = 0;
  requestConfig["axios-retry"] = {
    retries,
    retryDelay: (retryCount: number, error: AxiosError) => {
      if (!gate) {
        return (
          getNonNegativeIntegerHeader(error.response?.headers, LOGNEX_RETRY_AFTER_HEADER) ??
          DEFAULT_HTTP_RETRY_BASE_MS * Math.max(1, retryCount)
        );
      }

      const retryAfterMs = gate.observe(error.response?.status ?? 0, error.response?.headers);
      return gate.reserveDelay(retryAfterMs == null ? DEFAULT_HTTP_RETRY_BASE_MS * Math.max(1, retryCount) : 0);
    },
    retryCondition: (error: AxiosError) => {
      if (error.response?.status != null) {
        return shouldRetryHttpStatus(error.response.status);
      }
      return true;
    },
    onRetry: (retryCount: number, error: AxiosError) => {
      if (error.response?.status === 429) {
        lognexRetries += 1;
      }

      logMessage("WARN", `Retry attempt ${retryCount + 1} for ${method} ${url}`, {
        service: serviceName,
        status: error.response?.status,
        code: error.code
      });
    }
  };

  if (gate) {
    await gate.reserve();
  }
  const startedAt = Date.now();

  try {
    const response = await httpClient(requestConfig);
    gate?.observe(response.status, response.headers);
    const durationMs = Date.now() - startedAt;
    const attempt = getAttemptFromAxiosConfig(response.config);

    logHttpResponse(
      "DEBUG",
      method,
      url,
      options.serviceName,
      response.status,
      attempt,
      durationMs,
      response.headers,
      options.logBody === false ? undefined : response.data
    );

    const body = String(response.data ?? "");
    if (body === "") {
      if (options.allowEmptySuccessResponse) {
        return { data: {} as T, failure: null, retries: lognexRetries };
      }

      return { data: null, failure: null, retries: lognexRetries };
    }

    try {
      return { data: JSON.parse(body) as T, failure: null, retries: lognexRetries };
    } catch (error) {
      const message = `Failed to decode JSON for ${method} ${url}: ${error instanceof Error ? error.message : String(error)}`;

      logMessage("WARN", message, {
        service: options.serviceName ?? "external-api",
        kind: "decode",
        attempt,
        durationMs
      });

      return {
        data: null,
        failure: { kind: "decode", status: response.status, body, message },
        retries: lognexRetries
      };
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const axiosError = error as AxiosError;
    const attempt = getAttemptFromAxiosConfig(axiosError.config);

    if (axiosError.response) {
      gate?.observe(axiosError.response.status, axiosError.response.headers);
      logHttpResponse(
        "DEBUG",
        method,
        url,
        options.serviceName,
        axiosError.response.status,
        attempt,
        durationMs,
        axiosError.response.headers,
        options.logBody === false ? undefined : axiosError.response.data
      );

      const message = `HTTP ${axiosError.response.status} for ${method} ${url}`;

      logMessage("WARN", message, {
        service: options.serviceName ?? "external-api",
        kind: "http",
        status: axiosError.response.status,
        attempt,
        durationMs
      });

      return {
        data: null,
        failure: {
          kind: "http",
          status: axiosError.response.status,
          body: axiosError.response.data,
          message
        },
        retries: lognexRetries
      };
    }

    const message = buildTransportErrorMessage(error, method, url);

    logMessage("ERROR", message, {
      service: options.serviceName ?? "external-api",
      kind: "transport",
      attempt,
      durationMs
    });

    return {
      data: null,
      failure: { kind: "transport", status: null, body: null, message },
      retries: lognexRetries
    };
  }
}

function isRetryableMethod(method: Method): boolean {
  const normalized = String(method).toUpperCase();
  return normalized === "GET" || normalized === "PUT" || normalized === "DELETE";
}

function shouldRetryHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function getNonNegativeIntegerHeader(headers: unknown, headerName: string): number | null {
  const rawValue = getHeaderValue(headers, headerName);

  if (rawValue == null) {
    return null;
  }

  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
