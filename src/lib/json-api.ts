import { cfg } from "./config";
import { makeHttpRequest } from "./http-client";
import type { MoyskladEntityObject, MoyskladStoreListResponse } from "./types";

export class JsonApi {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async stores(): Promise<MoyskladStoreListResponse | null> {
    return makeHttpRequest<MoyskladStoreListResponse>(
      "GET",
      `${cfg().moyskladJsonApiEndpointUrl}/entity/store`,
      this.accessToken,
      null,
      { serviceName: "json-api", retryable: true }
    );
  }

  async getObject(entity: string, objectId: string): Promise<MoyskladEntityObject | null> {
    return makeHttpRequest<MoyskladEntityObject>(
      "GET",
      `${cfg().moyskladJsonApiEndpointUrl}/entity/${entity}/${objectId}`,
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
