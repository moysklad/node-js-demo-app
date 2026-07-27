import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
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
const originalContext = VendorApi.prototype.context;
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
  VendorApi.prototype.context = originalContext;
  VendorApi.prototype.updateLoyaltySettings = originalUpdate;
  VendorApi.prototype.updateAppStatus = originalUpdateStatus;
});

test("loyalty page renders the reference layout by default", async () => {
  VendorApi.prototype.context = async () => ({
    uid: "user-1",
    shortFio: "Пользователь",
    accountId: "account-1",
    permissions: { admin: { view: "ALL" } }
  });

  const server = await startServer(true);
  try {
    const response = await fetch(`${server.baseUrl}/entry/loyalty?contextKey=context-key`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /curl -X PUT/);
    assert.match(html, /id="requestExample"/);
    assert.match(html, /id="requestToggle"/);
    assert.match(html, /aria-controls="requestExample"/);
    assert.match(html, /hidden/);
    assert.match(html, /id="showOnboarding"/);
    assert.match(html, /id="onboarding"/);
    assert.match(html, /id="openAuth"/);
    assert.match(html, /id="openManual"/);
    assert.match(html, /id="authDialog"/);
    assert.match(html, /id="manualDialog"/);
  } finally {
    await server.close();
  }
});

test("loyalty iframe configures settings and allows switching search mode", async () => {
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
    assert.equal(
      (
        await postConnect(server.baseUrl, "https://tunnel.example/custom-loyalty", "manual-token", true)
      ).status,
      200
    );
    const update = updates[0] as { url: string; token: string; externalSearch: boolean };
    assert.deepEqual(update, {
      url: "https://tunnel.example/custom-loyalty",
      token: "manual-token",
      externalSearch: true
    });

    assert.equal(
      (await postConnect(server.baseUrl, "https://tunnel.example/custom-loyalty", "manual-token", false)).status,
      200
    );
    const updateAfterSwitch = updates[1] as { url: string; token: string; externalSearch: boolean };
    assert.deepEqual(updateAfterSwitch, {
      url: "https://tunnel.example/custom-loyalty",
      token: "manual-token",
      externalSearch: false
    });

    assert.equal(updates.length, 2);
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
  app.set("view engine", "ejs");
  app.set("views", path.join(process.cwd(), "src/features"));
  app.use(express.json());
  app.use(((req, _res, next) => {
    (req as unknown as { session: Record<string, unknown> }).session = session;
    next();
  }) as RequestHandler);
  app.use("/entry", createEntryRouter());

  const server = http.createServer(app);
  server.listen(0);
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

function postConnect(
  baseUrl: string,
  providerUrl?: string,
  providerToken?: string,
  externalSearch?: boolean
): Promise<Response> {
  return fetch(`${baseUrl}/entry/loyalty/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerUrl, providerToken, externalSearch })
  });
}
