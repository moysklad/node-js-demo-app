import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { createLoyaltyRouter } from "../src/loyalty/router";
import {
  LoyaltyInstallation,
  type LoyaltyInstallationData,
  type LoyaltyInstallationRepository
} from "../src/lib/domain/loyalty-installation";
import { LoyaltyBonusLedger } from "../src/lib/domain/loyalty-bonus-ledger";
import { SqliteLoyaltyBonusLedgerRepository } from "../src/lib/domain/loyalty-bonus-ledger-sqlite-repository";
import { LoyaltyCustomer } from "../src/lib/domain/loyalty-customer";
import { SqliteLoyaltyCustomerRepository } from "../src/lib/domain/loyalty-customer-sqlite-repository";

class MemoryInstallationRepository implements LoyaltyInstallationRepository {
  private readonly data: LoyaltyInstallationData = {
    appId: "app-1",
    accountId: "account-1",
    providerUrl: "https://demo.example/loyalty",
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

test("internal-search LoyaltyAPI registers a MoySklad counterparty and returns its balance", async () => {
  const server = startServer();
  try {
    const externalSearch = await fetch(`${server.baseUrl}/loyalty/counterparty?search=Иван&retailStoreId=store-1`, {
      headers: authHeaders()
    });
    const created = await postJson(server.baseUrl, "/loyalty/counterparty", counterpartyPayload());
    const detail = await postJson(server.baseUrl, "/loyalty/counterparty/detail", counterpartyPayload());

    assert.equal(externalSearch.status, 404);
    assert.equal(created.status, 201);
    assert.equal(await created.text(), "");
    assert.equal(detail.status, 200);
    assert.deepEqual(await detail.json(), { bonusProgram: { agentBonusBalance: 0 } });
    assert.ok(server.customers.find("app-1", "account-1", "customer-1"));
  } finally {
    await server.close();
  }
});

test("LoyaltyAPI recalculates bonuses without changing the balance", async () => {
  const server = startServer();
  try {
    await postJson(server.baseUrl, "/loyalty/counterparty", counterpartyPayload());
    const response = await postJson(server.baseUrl, "/loyalty/retaildemand/recalc", recalcPayload("EARNING"));
    const result = await response.json() as {
      bonusProgram: Record<string, unknown>;
      needVerification: boolean;
    };

    assert.equal(response.status, 200);
    assert.deepEqual(result.bonusProgram, {
      transactionType: "EARNING",
      agentBonusBalance: 0,
      bonusValueToSpend: 0,
      bonusValueToEarn: 10,
      agentBonusBalanceAfter: 10,
      paidByBonusPoints: 0,
      receiptExtraInfo: "Начислено баллов: 10."
    });
    assert.equal(result.needVerification, false);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 0);
  } finally {
    await server.close();
  }
});

test("LoyaltyAPI applies a sale and partial returns idempotently", async () => {
  const server = startServer();
  try {
    await postJson(server.baseUrl, "/loyalty/counterparty", counterpartyPayload());
    const customer = server.customers.find("app-1", "account-1", "customer-1");
    assert.ok(customer);
    server.customers.save({ ...customer, agentBonusBalance: 500 });

    const sale = salePayload("sale-1");
    assert.equal((await postJson(server.baseUrl, "/loyalty/retaildemand", sale)).status, 201);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 426);
    assert.equal((await postJson(server.baseUrl, "/loyalty/retaildemand", sale)).status, 201);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 426);

    const firstReturn = returnPayload("return-1", 1);
    delete firstReturn.agent;
    assert.equal((await postJson(server.baseUrl, "/loyalty/retailsalesreturn", firstReturn)).status, 201);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 463);
    assert.equal((await postJson(server.baseUrl, "/loyalty/retailsalesreturn", firstReturn)).status, 201);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 463);

    assert.equal((await postJson(server.baseUrl, "/loyalty/retailsalesreturn", returnPayload("return-2", 1))).status, 201);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 500);
  } finally {
    await server.close();
  }
});

test("LoyaltyAPI supports a sale and return paid fully with bonus points", async () => {
  const server = startServer();
  try {
    await postJson(server.baseUrl, "/loyalty/counterparty", counterpartyPayload());
    const customer = server.customers.find("app-1", "account-1", "customer-1");
    assert.ok(customer);
    server.customers.save({ ...customer, agentBonusBalance: 500 });

    const recalculationRequest = recalcPayload("SPENDING");
    recalculationRequest.preferredBonusToSpend = 200;
    const recalculationResponse = await postJson(
      server.baseUrl,
      "/loyalty/retaildemand/recalc",
      recalculationRequest
    );
    assert.equal(recalculationResponse.status, 200);
    const recalculation = await recalculationResponse.json() as {
      positions: unknown[];
      bonusProgram: { bonusValueToSpend: number; bonusValueToEarn: number };
    };
    assert.equal(recalculation.bonusProgram.bonusValueToSpend, 200);
    assert.equal(recalculation.bonusProgram.bonusValueToEarn, 0);

    const sale = {
      retailStore: { meta: documentMeta("retailstore", "store-1") },
      meta: documentMeta("retaildemand", "full-bonus-sale"),
      agent: agent(),
      positions: recalculation.positions,
      bonusProgram: recalculation.bonusProgram
    };
    assert.equal((await postJson(server.baseUrl, "/loyalty/retaildemand", sale)).status, 201);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 300);

    const returned = {
      retailStore: { meta: documentMeta("retailstore", "store-1") },
      meta: documentMeta("retailsalesreturn", "full-bonus-return"),
      demand: { meta: documentMeta("retaildemand", "full-bonus-sale") },
      agent: agent(),
      positions: recalculation.positions
    };
    assert.equal((await postJson(server.baseUrl, "/loyalty/retailsalesreturn", returned)).status, 201);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 500);
  } finally {
    await server.close();
  }
});

test("LoyaltyAPI keeps a zero-bonus sale link for a later return", async () => {
  const server = startServer();
  try {
    await postJson(server.baseUrl, "/loyalty/counterparty", counterpartyPayload());
    const sale = salePayload("zero-bonus-sale");
    sale.bonusProgram = { bonusValueToSpend: 0, bonusValueToEarn: 0 };
    sale.positions = [{
      assortment: { meta: documentMeta("product", "product-1") },
      quantity: 2,
      price: 100
    }];
    assert.equal((await postJson(server.baseUrl, "/loyalty/retaildemand", sale)).status, 201);

    const returned = returnPayload("zero-bonus-return", 2);
    (returned.demand as { meta: unknown }).meta = documentMeta("retaildemand", "zero-bonus-sale");
    assert.equal((await postJson(server.baseUrl, "/loyalty/retailsalesreturn", returned)).status, 201);
    assert.equal(server.customers.find("app-1", "account-1", "customer-1")?.agentBonusBalance, 0);
  } finally {
    await server.close();
  }
});

test("LoyaltyAPI validates authentication, registration and bonus operations", async () => {
  const server = startServer();
  try {
    const invalidToken = await fetch(`${server.baseUrl}/loyalty/counterparty`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lognex-Discount-API-Auth-Token": "invalid" },
      body: JSON.stringify(counterpartyPayload())
    });
    const invalidCustomer = await postJson(server.baseUrl, "/loyalty/counterparty", { name: "Без метаданных" });
    const unknownDetail = await postJson(server.baseUrl, "/loyalty/counterparty/detail", counterpartyPayload());
    const unknownRecalc = await postJson(server.baseUrl, "/loyalty/retaildemand/recalc", recalcPayload("EARNING"));

    assert.equal(invalidToken.status, 401);
    assert.equal(invalidCustomer.status, 412);
    assert.equal(unknownDetail.status, 404);
    assert.equal(unknownRecalc.status, 404);
  } finally {
    await server.close();
  }
});

function startServer(): {
  baseUrl: string;
  customers: SqliteLoyaltyCustomerRepository;
  close: () => Promise<void>;
} {
  const directory = mkdtempSync(path.join(os.tmpdir(), "loyalty-provider-test-"));
  const filename = path.join(directory, "app.sqlite");
  const customers = new SqliteLoyaltyCustomerRepository(filename);
  LoyaltyInstallation.configureRepository(new MemoryInstallationRepository());
  LoyaltyCustomer.configureRepository(customers);
  LoyaltyBonusLedger.configureRepository(new SqliteLoyaltyBonusLedgerRepository(filename));
  const app = express();
  app.use(express.json());
  app.use("/loyalty", createLoyaltyRouter());
  const listener = app.listen(0);
  const address = listener.address() as { port: number };
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    customers,
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
    name: "Иванов Иван",
    discountCardNumber: "123456",
    phone: "+79124567890"
  };
}

function agent(): Record<string, unknown> {
  return { meta: documentMeta("counterparty", "customer-1"), name: "Иванов Иван" };
}

function recalcPayload(transactionType: "EARNING" | "SPENDING"): Record<string, unknown> {
  return {
    retailStore: { meta: documentMeta("retailstore", "store-1") },
    agent: agent(),
    positions: [{ assortment: { meta: documentMeta("product", "product-1") }, quantity: 2, price: 100 }],
    bonusProgram: { transactionType }
  };
}

function salePayload(documentId: string): Record<string, unknown> {
  return {
    retailStore: { meta: documentMeta("retailstore", "store-1") },
    meta: documentMeta("retaildemand", documentId),
    agent: agent(),
    positions: [{
      assortment: { meta: documentMeta("product", "product-1") },
      quantity: 2,
      price: 100,
      discountPercent: 40,
      discountedPrice: 60
    }],
    bonusProgram: { bonusValueToSpend: 80, bonusValueToEarn: 6 }
  };
}

function returnPayload(documentId: string, quantity: number): Record<string, unknown> {
  return {
    retailStore: { meta: documentMeta("retailstore", "store-1") },
    meta: documentMeta("retailsalesreturn", documentId),
    demand: { meta: documentMeta("retaildemand", "sale-1") },
    agent: agent(),
    positions: [{
      assortment: { meta: documentMeta("product", "product-1") },
      quantity,
      price: 100,
      discountPercent: 40,
      discountedPrice: 60
    }]
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
