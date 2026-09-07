import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import test, { afterEach, beforeEach } from "node:test";
import express, { type RequestHandler } from "express";
import { createEntryRouter } from "../../src/entry/router";
import { config } from "../../src/lib/config/config";
import { AppInstance, type AppInstanceData, type AppInstanceRepository } from "../../src/lib/domain/app-instance";
import { JsonApi } from "../../src/lib/integrations/json-api";
import { VendorApi } from "../../src/lib/integrations/vendor-api";
import { saveActiveUserContextToSession, USER_CONTEXT_SESSION_KEY } from "../../src/lib/session/user-context";
import { createConnectLoyaltyRouter } from "../../src/loyalty/connect/router";
import {
  LoyaltyInstallation,
  type LoyaltyInstallationData,
  type LoyaltyInstallationRepository
} from "../../src/loyalty/domain/loyalty-installation";
import { LoyaltyVendorApiClient } from "../../src/loyalty/vendor-api";

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
const originalUpdate = LoyaltyVendorApiClient.prototype.updateLoyaltySettings;
const originalUpdateStatus = VendorApi.prototype.updateAppStatus;
const originalStoresNames = JsonApi.prototype.storesNames;

let session: Record<string, unknown>;
let installations: MemoryInstallationRepository;

beforeEach(() => {
  config.appId = "app-1";
  session = {};
  installations = new MemoryInstallationRepository();
  LoyaltyInstallation.configureRepository(installations);
  AppInstance.configureRepository(new MemoryAppRepository());
  JsonApi.prototype.storesNames = async () => ["Основной склад"];
});

afterEach(() => {
  config.appId = originalAppId;
  VendorApi.prototype.context = originalContext;
  LoyaltyVendorApiClient.prototype.updateLoyaltySettings = originalUpdate;
  VendorApi.prototype.updateAppStatus = originalUpdateStatus;
  JsonApi.prototype.storesNames = originalStoresNames;
});

test("основной iframe отдает вкладку программы лояльности", async () => {
  VendorApi.prototype.context = async () => ({
    uid: "user-1",
    shortFio: "Пользователь",
    accountId: "account-1",
    permissions: { admin: { view: "ALL" } }
  });

  const server = await startServer(true);

  try {
    const response = await fetch(`${server.baseUrl}/entry/iframe?contextKey=context-key`);
    const html = await response.text();

    assert.equal(response.status, 200);

    // Обе точки встраивания живут на одной странице.
    assert.match(html, /data-tab="main"/);
    assert.match(html, /data-tab="loyalty"/);
    assert.match(html, /id="settingsForm"/);

    assert.match(html, /id="loyaltyStatus"/);
    assert.match(html, /ПРОГРАММА ЛОЯЛЬНОСТИ НЕ ПОДКЛЮЧЕНА/);
    assert.match(html, /id="manualDialog"/);
  } finally {
    await server.close();
  }
});

test("подключение передает настройки в Vendor API и не трогает статус решения", async () => {
  const updates: unknown[] = [];
  let statusUpdates = 0;

  LoyaltyVendorApiClient.prototype.updateLoyaltySettings = async (_appId, _accountId, data) => {
    updates.push(data);
    return { ok: true };
  };
  VendorApi.prototype.updateAppStatus = async () => {
    statusUpdates += 1;
    return { status: "Activated" as const };
  };

  const server = await startServer(true);

  try {
    const response = await postConnect(server.baseUrl, {
      providerUrl: "https://tunnel.example/custom-loyalty",
      providerToken: "manual-token",
      externalSearch: true
    });
    const payload = (await response.json()) as { loyalty: { state: string; externalSearch: boolean } };

    assert.equal(response.status, 200);
    assert.deepEqual(updates[0], {
      url: "https://tunnel.example/custom-loyalty",
      token: "manual-token",
      externalSearch: true
    });
    assert.equal(payload.loyalty.state, "connected");
    assert.equal(payload.loyalty.externalSearch, true);
    assert.notEqual(installations.load("app-1", "account-1")?.connectedAt, null);

    // Готовность решения определяется обязательными настройками, а не лояльностью.
    assert.equal(statusUpdates, 0);
  } finally {
    await server.close();
  }
});

test("токен сохраняется до обращения к Vendor API, чтобы не потеряться при сбое", async () => {
  LoyaltyVendorApiClient.prototype.updateLoyaltySettings = async () => ({
    ok: false,
    error: { code: 2006, message: "Указаны данные программы лояльности для решения без поддержки loyaltyApi" }
  });

  const server = await startServer(true);

  try {
    const response = await postConnect(server.baseUrl, {
      providerUrl: "https://tunnel.example/custom-loyalty",
      providerToken: "manual-token",
      externalSearch: true
    });
    const stored = installations.load("app-1", "account-1");

    assert.equal(response.status, 502);
    // Причина отказа Vendor API должна доезжать до пользователя, а не теряться в логах.
    const text = await response.text();
    assert.match(text, /2006/);
    assert.match(text, /loyaltyApi/);
    // МойСклад мог получить токен до сбоя, поэтому решение обязано его помнить.
    assert.equal(stored?.providerToken, "manual-token");
    // Но подключенным решение себя не считает: настройки нужно отправить заново.
    assert.equal(stored?.connectedAt, null);
  } finally {
    await server.close();
  }
});

test("подключение без contextNonce отклоняется", async () => {
  const server = await startServer(true);

  try {
    const response = await fetch(`${server.baseUrl}/utils/connect-loyalty`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerUrl: "https://tunnel.example/loyalty", providerToken: "manual-token" })
    });

    assert.equal(response.status, 401);
    assert.equal(installations.load("app-1", "account-1"), null);
  } finally {
    await server.close();
  }
});

test("подключение недоступно пользователю без прав администратора", async () => {
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
  app.use("/utils", createConnectLoyaltyRouter());

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
  body: { providerUrl?: string; providerToken?: string; externalSearch?: boolean } = {}
): Promise<Response> {
  return fetch(`${baseUrl}/utils/connect-loyalty`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, contextNonce: currentContextNonce() })
  });
}

function currentContextNonce(): string {
  const context = session[USER_CONTEXT_SESSION_KEY] as { contextNonce?: string } | undefined;

  return context?.contextNonce ?? "";
}
