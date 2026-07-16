import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test, { afterEach, beforeEach } from "node:test";
import express, { type RequestHandler } from "express";
import { createEntryRouter } from "../src/entry/router";
import { config } from "../src/lib/config/config";
import { AppInstance, type AppInstanceData, type AppInstanceRepository } from "../src/lib/domain/app-instance";
import {
  LoyaltyInstallation,
  type LoyaltyInstallationData,
  type LoyaltyInstallationRepository
} from "../src/lib/domain/loyalty-installation";
import { VendorApi } from "../src/lib/integrations/vendor-api";
import { saveActiveUserContextToSession } from "../src/lib/session/user-context";

class MemoryInstallationRepository implements LoyaltyInstallationRepository {
  private readonly rows = new Map<string, LoyaltyInstallationData>();
  load(appId: string, accountId: string): LoyaltyInstallationData | null {
    return this.rows.get(`${appId}:${accountId}`) ?? null;
  }
  findByToken(token: string): LoyaltyInstallationData | null {
    return [...this.rows.values()].find((row) => row.providerToken === token) ?? null;
  }
  save(data: LoyaltyInstallationData): void {
    this.rows.set(`${data.appId}:${data.accountId}`, data);
  }
  delete(appId: string, accountId: string): void {
    this.rows.delete(`${appId}:${accountId}`);
  }
}

class MemoryAppRepository implements AppInstanceRepository {
  private readonly rows = new Map<string, AppInstanceData>();
  load(appId: string, accountId: string): AppInstanceData | null {
    return this.rows.get(`${appId}:${accountId}`) ?? null;
  }
  save(data: AppInstanceData): void {
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
  LoyaltyInstallation.configureRepository(new MemoryInstallationRepository());
  AppInstance.configureRepository(new MemoryAppRepository());
});

afterEach(() => {
  config.appId = originalAppId;
  VendorApi.prototype.updateLoyaltySettings = originalUpdate;
  VendorApi.prototype.updateAppStatus = originalUpdateStatus;
});

test("loyalty iframe configures internal search once", async () => {
  const updates: unknown[] = [];
  let statusUpdates = 0;
  VendorApi.prototype.updateLoyaltySettings = async (_appId, _accountId, data) => {
    updates.push(data);
    return true;
  };
  VendorApi.prototype.updateAppStatus = async () => {
    statusUpdates += 1;
    return { status: "Activated" };
  };

  const server = await startServer(true);
  try {
    assert.equal((await postConnect(server.baseUrl, "https://tunnel.example/custom-loyalty")).status, 200);
    const update = updates[0] as { url: string; token: string; externalSearch: boolean };
    assert.deepEqual(update, {
      url: "https://tunnel.example/custom-loyalty",
      token: update.token,
      externalSearch: false
    });

    assert.equal((await postConnect(server.baseUrl)).status, 200);
    assert.equal(updates.length, 1);
    assert.equal(statusUpdates, 1);
  } finally {
    await server.close();
  }
});

test("loyalty iframe rejects configuration by a non-admin", async () => {
  const server = await startServer(false);
  try {
    assert.equal((await postConnect(server.baseUrl)).status, 403);
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

function postConnect(baseUrl: string, providerUrl?: string): Promise<Response> {
  return fetch(`${baseUrl}/entry/loyalty/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerUrl })
  });
}
