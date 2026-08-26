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

export type VendorApiCallResult = {
  ok: boolean;
  error?: { code: number | null; message: string };
};

/**
 * Клиент Vendor API для передачи настроек Loyalty API.
 * Живет в модуле лояльности отдельно от общего клиента: методы `PUT /apps/{appId}/{accountId}/loyalty`
 * нет у решений без точки встраивания лояльности, а общий клиент не должен про нее знать.
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
      return { ok: true };
    }

    return { ok: false, error: describeVendorApiFailure(result.failure) };
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
