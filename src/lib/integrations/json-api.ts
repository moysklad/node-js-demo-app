import { config } from "../config/config";
import { makeHttpRequest } from "../http/http-client";
import type {
  MoyskladCounterparty,
  MoyskladCounterpartyListResponse,
  MoyskladCounterpartyUpsertRequest,
  MoyskladEntityObject,
  MoyskladStoreListResponse
} from "../domain/types";

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

  async searchCounterparties(search: string): Promise<MoyskladCounterpartyListResponse | null> {
    return makeHttpRequest<MoyskladCounterpartyListResponse>(
      "GET",
      `${this.baseUrl}/entity/counterparty?search=${encodeURIComponent(search)}`,
      this.accessToken,
      null,
      {
        serviceName: "json-api",
        retryable: true
      }
    ).then((response) => {
      if (!response?.rows) {
        return response;
      }

      const normalizedSearch = search.trim().toLowerCase();
      const rows = response.rows.filter((row) => matchesCounterpartySearch(row, normalizedSearch));
      return { rows };
    });
  }

  async upsertCounterparty(data: MoyskladCounterpartyUpsertRequest): Promise<MoyskladCounterparty | null> {
    return makeHttpRequest<MoyskladCounterparty>(
      "POST",
      `${this.baseUrl}/entity/counterparty`,
      this.accessToken,
      data,
      {
        serviceName: "json-api",
        retryable: false
      }
    );
  }
}

const jsonApiFactory = (accessToken: string) => new JsonApi(accessToken);

export function jsonApi(accessToken: string): JsonApi {
  return jsonApiFactory(accessToken);
}

function matchesCounterpartySearch(row: MoyskladCounterparty, search: string): boolean {
  if (search === "") {
    return true;
  }

  const fields = [
    row.name,
    row.discountCardNumber,
    row.phone,
    row.email,
    row.legalFirstName,
    row.legalMiddleName,
    row.legalLastName,
    row.syncId,
    row.id,
    row.msId
  ];

  return fields.some((value) => typeof value === "string" && value.toLowerCase().includes(search));
}
