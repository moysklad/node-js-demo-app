import { config } from "../config/config";
import { makeHttpRequest, makeHttpRequestDetailed } from "../http/http-client";
import type { MoyskladEntityObject, MoyskladStoreListResponse } from "../domain/types";

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
}

const jsonApiFactory = (accessToken: string) => new JsonApi(accessToken);

export function jsonApi(accessToken: string): JsonApi {
  return jsonApiFactory(accessToken);
}
