import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createLoyaltyRouter } from "../src/loyalty/router";
import { AppInstance, type AppInstanceData, type AppInstanceRepository } from "../src/lib/domain/app-instance";
import { LoyaltyAccount, type LoyaltyAccountData, type LoyaltyAccountRepository } from "../src/lib/domain/loyalty-account";
import { JsonApi } from "../src/lib/integrations/json-api";
import type { MoyskladCounterpartyUpsertRequest } from "../src/lib/domain/types";

class MemoryAccountRepository implements LoyaltyAccountRepository {
  private readonly data: LoyaltyAccountData = {
    appId: "app-1",
    accountId: "account-1",
    login: "demo",
    passwordHash: "hash",
    token: "provider-token",
    updatedAt: Date.now()
  };
  load(): LoyaltyAccountData {
    return this.data;
  }
  findByLogin(): LoyaltyAccountData {
    return this.data;
  }
  findByToken(token: string): LoyaltyAccountData | null {
    return token === this.data.token ? this.data : null;
  }
  save(): void {}
  delete(): void {}
}

class MemoryAppInstanceRepository implements AppInstanceRepository {
  private readonly data: AppInstanceData = {
    appId: "app-1",
    accountId: "account-1",
    infoMessage: "",
    store: "Main store",
    accessToken: "ms-access-token",
    status: 3,
    updatedAt: Date.now()
  };
  load(): AppInstanceData {
    return this.data;
  }
  save(): void {}
  delete(): void {}
}

test("LoyaltyAPI counterparty validates token and returns customer rows", async () => {
  LoyaltyAccount.configureRepository(new MemoryAccountRepository());
  AppInstance.configureRepository(new MemoryAppInstanceRepository());
  const originalSearch = JsonApi.prototype.searchCounterparties;
  JsonApi.prototype.searchCounterparties = async () => ({
    rows: [{
      id: "customer-1",
      msId: "ms-1",
      name: "Иванов Иван",
      discountCardNumber: "123456",
      phone: "+79124567890",
      email: null,
      legalFirstName: "Иван",
      legalMiddleName: null,
      legalLastName: "Иванов",
      birthDate: null,
      sex: "MALE"
    }]
  });
  const app = express();
  app.use("/loyalty", createLoyaltyRouter());
  const server = app.listen(0);

  try {
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/loyalty/counterparty?search=123456&retailStoreId=store-1`, {
      headers: { "Lognex-Discount-API-Auth-Token": "provider-token" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).rows[0], {
      id: "customer-1",
      msId: "ms-1",
      name: "Иванов Иван",
      discountCardNumber: "123456",
      phone: "+79124567890",
      email: null,
      legalFirstName: "Иван",
      legalMiddleName: null,
      legalLastName: "Иванов",
      birthDate: null,
      sex: "MALE"
    });
  } finally {
    JsonApi.prototype.searchCounterparties = originalSearch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("LoyaltyAPI counterparty supports upsert and rejects invalid token", async () => {
  LoyaltyAccount.configureRepository(new MemoryAccountRepository());
  AppInstance.configureRepository(new MemoryAppInstanceRepository());
  const originalUpsert = JsonApi.prototype.upsertCounterparty;
  JsonApi.prototype.upsertCounterparty = async (data: MoyskladCounterpartyUpsertRequest) => ({
    id: "customer-1",
    msId: "ms-1",
    name: data.name ?? "",
    discountCardNumber: data.discountCardNumber ?? "",
    phone: data.phone ?? null,
    email: data.email ?? null,
    legalFirstName: data.legalFirstName ?? null,
    legalMiddleName: data.legalMiddleName ?? null,
    legalLastName: data.legalLastName ?? null,
    birthDate: data.birthDate ?? null,
    sex: data.sex ?? null
  });
  const app = express();
  app.use(express.json());
  app.use("/loyalty", createLoyaltyRouter());
  const server = app.listen(0);

  try {
    const address = server.address() as { port: number };
    const created = await fetch(`http://127.0.0.1:${address.port}/loyalty/counterparty`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lognex-Discount-API-Auth-Token": "provider-token"
      },
      body: JSON.stringify({
        name: "Иванов Иван",
        discountCardNumber: "123456",
        phone: "+79124567890",
        email: "demo@example.com",
        legalFirstName: "Иван",
        legalLastName: "Иванов"
      })
    });
    const invalid = await fetch(`http://127.0.0.1:${address.port}/loyalty/counterparty`, {
      headers: { "Lognex-Discount-API-Auth-Token": "provider-token" }
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).name, "Иванов Иван");
    assert.equal(invalid.status, 401);
  } finally {
    JsonApi.prototype.upsertCounterparty = originalUpsert;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("LoyaltyAPI counterparty detail returns bonus balance", async () => {
  LoyaltyAccount.configureRepository(new MemoryAccountRepository());
  AppInstance.configureRepository(new MemoryAppInstanceRepository());
  const app = express();
  app.use(express.json());
  app.use("/loyalty", createLoyaltyRouter());
  const server = app.listen(0);

  try {
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/loyalty/counterparty/detail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lognex-Discount-API-Auth-Token": "provider-token"
      },
      body: JSON.stringify({
        retailStore: {
          meta: {
            href: "https://api.moysklad.ru/api/remap/1.2/entity/retailstore/store-1",
            id: "store-1"
          },
          name: "Магазин №1"
        },
        meta: {
          href: "https://api.moysklad.ru/api/remap/1.2/entity/counterparty/customer-1",
          id: "customer-1"
        },
        name: "Иванов Иван",
        discountCardNumber: "123456",
        phone: "+79124567890",
        email: "demo@example.com",
        legalFirstName: "Иван",
        legalLastName: "Иванов",
        sex: "MALE"
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      bonusProgram: {
        agentBonusBalance: 500
      }
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("LoyaltyAPI counterparty detail identifies buyer by required metadata only", async () => {
  LoyaltyAccount.configureRepository(new MemoryAccountRepository());
  AppInstance.configureRepository(new MemoryAppInstanceRepository());
  const app = express();
  app.use(express.json());
  app.use("/loyalty", createLoyaltyRouter());
  const server = app.listen(0);

  try {
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/loyalty/counterparty/detail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lognex-Discount-API-Auth-Token": "provider-token"
      },
      body: JSON.stringify({
        retailStore: { meta: { href: "https://api.example/store/store-1", id: "store-1" } },
        meta: { href: "https://api.example/counterparty/customer-1", id: "customer-1" }
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { bonusProgram: { agentBonusBalance: 500 } });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
