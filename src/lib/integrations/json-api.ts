import { config } from "../config/config";
import { makeHttpRequest, makeHttpRequestDetailed, type HttpResult } from "../http/http-client";
import type { MoyskladEntityObject, MoyskladStoreListResponse } from "../domain/types";

// Сценарий отвечает МоемуСкладу не дольше 10 секунд, поэтому объект запрашивается один раз
// и с общим бюджетом времени на ожидание лимитера и сам запрос.
const SCENARIO_OBJECT_BUDGET_MS = 5000;

// objectType из сценария — имя сущности в МоемСкладе; в URL JSON API оно пишется строчными,
// кроме контрагента: он приходит как Company, а ресурс называется counterparty.
const JSON_API_ENTITY_BY_OBJECT_TYPE: Record<string, string> = { Company: "counterparty" };

export function jsonApiEntity(objectType: string): string {
  return JSON_API_ENTITY_BY_OBJECT_TYPE[objectType] ?? objectType.toLowerCase();
}

export class JsonApi {
  private readonly accessToken: string;
  private readonly baseUrl: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.baseUrl = config.moyskladJsonApiEndpointUrl;
  }

  async stores(): Promise<MoyskladStoreListResponse | null> {
    return makeHttpRequest<MoyskladStoreListResponse>(
      "GET",
      `${this.baseUrl}/entity/store`,
      this.accessToken,
      null,
      { serviceName: "json-api", retryable: true }
    );
  }

  /** Список складов и число повторов по X-Lognex-Retry-After: см. проверку ретраев в iframe. */
  async storesWithRetries(): Promise<{ stores: MoyskladStoreListResponse | null; retries: number }> {
    const result = await makeHttpRequestDetailed<MoyskladStoreListResponse>(
      "GET",
      `${this.baseUrl}/entity/store`,
      this.accessToken,
      null,
      { serviceName: "json-api", retryable: true }
    );

    return { stores: result.data, retries: result.retries };
  }

  async storesNames(): Promise<string[]> {
    const stores = await this.stores();

    if (!Array.isArray(stores?.rows)) {
      return [];
    }

    const names: string[] = [];

    for (const store of stores.rows) {
      if (store?.name) {
        names.push(store.name);
      }
    }

    return names;
  }

  async getObject(entity: string, objectId: string): Promise<MoyskladEntityObject | null> {
    return makeHttpRequest<MoyskladEntityObject>(
      "GET",
      `${this.baseUrl}/entity/${entity}/${objectId}`,
      this.accessToken,
      null,
      { serviceName: "json-api", retryable: true }
    );
  }

  async getScenarioObject(entity: string, objectId: string): Promise<HttpResult<MoyskladEntityObject>> {
    return makeHttpRequestDetailed<MoyskladEntityObject>(
      "GET",
      `${this.baseUrl}/entity/${entity}/${objectId}`,
      this.accessToken,
      null,
      { serviceName: "json-api", retryable: false, budgetMs: SCENARIO_OBJECT_BUDGET_MS }
    );
  }
}

const jsonApiFactory = (accessToken: string) => new JsonApi(accessToken);

export function jsonApi(accessToken: string): JsonApi {
  return jsonApiFactory(accessToken);
}
