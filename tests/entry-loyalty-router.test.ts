import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test, { afterEach, beforeEach } from "node:test";
import express, { type RequestHandler } from "express";
import { createEntryRouter } from "../src/entry/router";
import { config } from "../src/lib/config/config";
import { Loyalty, type LoyaltyRepository, type LoyaltySettingsData } from "../src/lib/domain/loyalty";
import { LoyaltyAccount, type LoyaltyAccountData, type LoyaltyAccountRepository } from "../src/lib/domain/loyalty-account";
import { VendorApi } from "../src/lib/integrations/vendor-api";
import { saveActiveUserContextToSession } from "../src/lib/session/user-context";

class MemoryLoyaltyRepository implements LoyaltyRepository {
  private row: LoyaltySettingsData | null = null;
  load(): LoyaltySettingsData | null {
    return this.row;
  }
  save(data: LoyaltySettingsData): void {
    this.row = data;
  }
  delete(): void {}
}

class MemoryAccountRepository implements LoyaltyAccountRepository {
  private readonly rows = new Map<string, LoyaltyAccountData>();
  load(appId: string, accountId: string): LoyaltyAccountData | null {
    return this.rows.get(`${appId}:${accountId}`) ?? null;
  }
  findByLogin(login: string): LoyaltyAccountData | null {
    return [...this.rows.values()].find((row) => row.login === login) ?? null;
  }
  findByToken(token: string): LoyaltyAccountData | null {
    return [...this.rows.values()].find((row) => row.token === token) ?? null;
  }
  save(data: LoyaltyAccountData): void {
    this.rows.set(`${data.appId}:${data.accountId}`, data);
  }
  delete(appId: string, accountId: string): void {
    this.rows.delete(`${appId}:${accountId}`);
  }
}

const originalAppId = config.appId;
const originalUpdate = VendorApi.prototype.updateLoyaltySettings;
const originalUpdateStatus = VendorApi.prototype.updateAppStatus;
let session: Record<string, unknown>;

beforeEach(() => {
  config.appId = "app-1";
  session = {};
  Loyalty.configureRepository(new MemoryLoyaltyRepository());
  LoyaltyAccount.configureRepository(new MemoryAccountRepository());
  VendorApi.prototype.updateAppStatus = async () => ({ status: "Activated" });
});

afterEach(() => {
  config.appId = originalAppId;
  VendorApi.prototype.updateLoyaltySettings = originalUpdate;
  VendorApi.prototype.updateAppStatus = originalUpdateStatus;
});

test("loyalty iframe registers account and forwards settings", async () => {
  const updates: unknown[] = [];
  VendorApi.prototype.updateLoyaltySettings = async (_appId, _accountId, data) => {
    updates.push(data);
    return true;
  };

  const server = await startServer(true);
  try {
    const response = await fetch(`${server.baseUrl}/entry/loyalty/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "register", login: "demo", password: "password123" })
    });

    assert.equal(response.status, 200);
    const update = updates[0] as { url: string; token: string; externalSearch: boolean };
    assert.deepEqual(update, {
      url: `${config.appBaseUrl}/loyalty`,
      token: update.token,
      externalSearch: true
    });
  } finally {
    await server.close();
  }
});

test("loyalty iframe rejects non-admin registration", async () => {
  const server = await startServer(false);
  try {
    const response = await fetch(`${server.baseUrl}/entry/loyalty/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "register", login: "demo", password: "password123" })
    });

    assert.equal(response.status, 403);
  } finally {
    await server.close();
  }
});

async function startServer(isAdmin: boolean): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  saveActiveUserContextToSession(
    { session } as unknown as Parameters<typeof saveActiveUserContextToSession>[0],
    { uid: "user-1", fio: "Пользователь", accountId: "account-1", isAdmin }
  );

  const app = express();
  app.use(express.json());
  app.use(((req, _res, next) => {
    (req as unknown as { session: Record<string, unknown> }).session = session;
    next();
  }) as RequestHandler);
  app.use("/entry", createEntryRouter());

  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.close();
      await once(server, "close");
    }
  };
}
