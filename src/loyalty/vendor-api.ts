import { config } from "../lib/config/config";
import { makeHttpRequestDetailed, type HttpFailure } from "../lib/http/http-client";
import { buildVendorApiJwt } from "../lib/integrations/vendor-api";
import type { VendorApiLoyaltyData } from "./types";

/**
 * Ошибка Vendor API в документированном формате: {"errors": [{"error": "...", "code": 2006}]}.
 */
type VendorApiErrorBody = {
  errors?: Array<{ error?: string; code?: number; parameter?: string }>;
};

/**
 * ok — МойСклад принял настройки; rejected — точно не принял (4xx с errors); unknown — ответа нет
 * или 5xx, настройки могли примениться, и решение должно принимать оба токена до следующего успеха.
 */
export type VendorApiCallResult = {
  outcome: "ok" | "rejected" | "unknown";
  code: number | null;
  message: string;
};

/**
 * Клиент Vendor API для передачи настроек Loyalty API.
 * Живет в модуле лояльности отдельно от общего клиента: методы `PUT /apps/{appId}/{accountId}/loyalty`
 * нет у решений без программы лояльности, а общий клиент не должен про нее знать.
 */
export class LoyaltyVendorApiClient {
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
      return { outcome: "ok", code: null, message: "" };
    }

    // Отказ — только 4xx с описанием ошибки; ответ без описания мог означать и принятые настройки.
    const failure = result.failure;
    const described = describeVendorApiFailure(failure);
    const rejected = failure?.kind === "http" && failure.status !== null && failure.status < 500 && described.described;

    return { outcome: rejected ? "rejected" : "unknown", code: described.code, message: described.message };
  }
}

let clientInstance: LoyaltyVendorApiClient = new LoyaltyVendorApiClient();

export function loyaltyVendorApi(): LoyaltyVendorApiClient {
  return clientInstance;
}

/**
 * Достает из отказа причину, понятную пользователю решения.
 * Общее «не удалось» вынуждает вендора искать проблему вслепую, поэтому показываем,
 * что именно ответил МойСклад, и подсказываем частые причины.
 */
function describeVendorApiFailure(failure: HttpFailure | null): { code: number | null; message: string; described: boolean } {
  if (!failure) {
    return { code: null, message: "МойСклад вернул неожиданный ответ", described: false };
  }

  if (failure.kind !== "http") {
    return { code: null, message: `Не удалось обратиться к Vendor API: ${failure.message}`, described: false };
  }

  const body = parseVendorApiErrorBody(failure.body);
  const first = body?.errors?.[0];

  if (!first?.error) {
    return { code: null, message: `Vendor API ответил статусом ${failure.status ?? "?"} без описания ошибки`, described: false };
  }

  const code = typeof first.code === "number" ? first.code : null;
  const hint = vendorApiErrorHint(code);

  return { code, message: hint ? `${first.error}. ${hint}` : first.error, described: true };
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
