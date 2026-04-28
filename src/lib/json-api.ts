import { cfg } from "./config";
import { makeHttpRequest } from "./http-client";
import type { MoyskladEntityObject, MoyskladStoreListResponse } from "./types";

export class JsonApi {
  private readonly accessToken: string;
  private readonly baseUrl: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.baseUrl = cfg().moyskladJsonApiEndpointUrl;
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
