import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createLoyaltyRouter } from "../src/loyalty/router";
import {
  LoyaltyInstallation,
  type LoyaltyInstallationData,
  type LoyaltyInstallationRepository
} from "../src/lib/domain/loyalty-installation";

class MemoryInstallationRepository implements LoyaltyInstallationRepository {
  private readonly data: LoyaltyInstallationData = {
    appId: "app-1",
    accountId: "account-1",
    providerToken: "provider-token",
    externalSearch: false,
    updatedAt: Date.now()
  };

  load(): LoyaltyInstallationData { return this.data; }
  findByToken(token: string): LoyaltyInstallationData | null {
    return token === this.data.providerToken ? this.data : null;
  }
  save(): void {}
  delete(): void {}
}

test("LoyaltyAPI exposes authenticated contract stubs for internal search", async () => {
  const server = startServer();
  try {
    const externalSearch = await fetch(`${server.baseUrl}/loyalty/counterparty?search=Иван&retailStoreId=store-1`, {
      headers: authHeaders()
    });
    assert.equal(externalSearch.status, 404);

    const created = await postJson(server.baseUrl, "/loyalty/counterparty", counterpartyPayload());
    assert.equal(created.status, 201);
    assert.equal(await created.text(), "");

    const detail = await postJson(server.baseUrl, "/loyalty/counterparty/detail", counterpartyPayload());
    assert.equal(detail.status, 200);
    assert.deepEqual(await detail.json(), { bonusProgram: { agentBonusBalance: 0 } });

    const recalculated = await postJson(server.baseUrl, "/loyalty/retaildemand/recalc", recalcPayload());
    assert.equal(recalculated.status, 200);
    assert.deepEqual(await recalculated.json(), {
      agent: agent(),
      positions: [{
        assortment: { meta: documentMeta("product", "product-1") },
        quantity: 2,
        price: 100,
        discountPercent: 0,
        discountedPrice: 100
      }],
      bonusProgram: {
        transactionType: "EARNING",
        agentBonusBalance: 0,
        bonusValueToSpend: 0,
        bonusValueToEarn: 0,
        agentBonusBalanceAfter: 0,
        paidByBonusPoints: 0,
        receiptExtraInfo: ""
      },
      needVerification: false
    });

    assert.equal((await postJson(server.baseUrl, "/loyalty/retaildemand", documentPayload("retaildemand"))).status, 201);
    assert.equal(
      (await postJson(server.baseUrl, "/loyalty/retailsalesreturn", documentPayload("retailsalesreturn"))).status,
      201
    );
  } finally {
    await server.close();
  }
});

test("LoyaltyAPI rejects an invalid authorization token", async () => {
  const server = startServer();
  try {
    const response = await fetch(`${server.baseUrl}/loyalty/counterparty`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lognex-Discount-API-Auth-Token": "invalid" },
      body: JSON.stringify(counterpartyPayload())
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      errors: [{
        error: "Недействительный токен авторизации",
        code: 999,
        error_message: "Недействительный токен авторизации"
      }]
    });
  } finally {
    await server.close();
  }
});

function startServer(): { baseUrl: string; close: () => Promise<void> } {
  LoyaltyInstallation.configureRepository(new MemoryInstallationRepository());
  const app = express();
  app.use(express.json());
  app.use("/loyalty", createLoyaltyRouter());
  const listener = app.listen(0);
  const address = listener.address() as { port: number };
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => listener.close(() => resolve()))
  };
}

function postJson(baseUrl: string, pathname: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function authHeaders(): Record<string, string> {
  return { "Lognex-Discount-API-Auth-Token": "provider-token" };
}

function counterpartyPayload(): Record<string, unknown> {
  return {
    retailStore: { meta: documentMeta("retailstore", "store-1") },
    meta: documentMeta("counterparty", "customer-1"),
    name: "Иванов Иван"
  };
}

function agent(): Record<string, unknown> {
  return { meta: documentMeta("counterparty", "customer-1"), name: "Иванов Иван" };
}

function recalcPayload(): Record<string, unknown> {
  return {
    retailStore: { meta: documentMeta("retailstore", "store-1") },
    agent: agent(),
    positions: [{ assortment: { meta: documentMeta("product", "product-1") }, quantity: 2, price: 100 }],
    bonusProgram: { transactionType: "EARNING" }
  };
}

function documentPayload(type: "retaildemand" | "retailsalesreturn"): Record<string, unknown> {
  return {
    retailStore: { meta: documentMeta("retailstore", "store-1") },
    meta: documentMeta(type, `${type}-1`),
    agent: agent(),
    positions: [{ assortment: { meta: documentMeta("product", "product-1") }, quantity: 2, price: 100 }]
  };
}

function documentMeta(type: string, id: string): Record<string, unknown> {
  return {
    href: `https://api.moysklad.ru/api/remap/1.2/entity/${type}/${id}`,
    id,
    idType: "native",
    type
  };
}
