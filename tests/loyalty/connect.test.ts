// Интеграционный тест: HTTP-маршруты приложения или PostgreSQL.
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, test } from "node:test";
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

  async load(appId: string, accountId: string): Promise<LoyaltyInstallationData | null> {
    return this.rows.get(`${appId}:${accountId}`) ?? null;
  }

  async findByToken(token: string): Promise<LoyaltyInstallationData | null> {
    return [...this.rows.values()].find((row) => row.providerToken === token) ?? null;
  }

  async updateLocked(
    appId: string,
    accountId: string,
    change: (data: LoyaltyInstallationData | null) => LoyaltyInstallationData | null
  ): Promise<void> {
    const changed = change(await this.load(appId, accountId));

    if (changed) {
      await this.save(changed);
    }
  }

  async save(data: LoyaltyInstallationData): Promise<void> {
    this.rows.set(`${data.appId}:${data.accountId}`, data);
  }

  async delete(appId: string, accountId: string): Promise<void> {
    this.rows.delete(`${appId}:${accountId}`);
  }
}

class MemoryAppRepository implements AppInstanceRepository {
  private readonly rows = new Map<string, AppInstanceData>();

  async load(appId: string, accountId: string): Promise<AppInstanceData | null> {
    return this.rows.get(`${appId}:${accountId}`) ?? null;
  }

  async save(data: AppInstanceData): Promise<void> {
    this.rows.set(`${data.appId}:${data.accountId}`, data);
  }

  async delete(appId: string, accountId: string): Promise<void> {
    this.rows.delete(`${appId}:${accountId}`);
  }
}

const originalAppId = config.appId;
const originalExchange = VendorApi.prototype.exchangeUserContext;
const originalUpdate = LoyaltyVendorApiClient.prototype.updateLoyaltySettings;
const originalUpdateStatus = VendorApi.prototype.updateAppStatus;
const originalStoresNames = JsonApi.prototype.storesNames;

let session: Record<string, unknown>;
let installations: MemoryInstallationRepository;

describe("Подключение Loyalty API", () => {
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
    VendorApi.prototype.exchangeUserContext = originalExchange;
    LoyaltyVendorApiClient.prototype.updateLoyaltySettings = originalUpdate;
    VendorApi.prototype.updateAppStatus = originalUpdateStatus;
    JsonApi.prototype.storesNames = originalStoresNames;
  });

  test("основной iframe отдает вкладку программы лояльности", async () => {
    VendorApi.prototype.exchangeUserContext = async () => ({
      ok: true,
      data: { accountId: "account-1", userId: "user-id-1", userUid: "user-1", role: "admin" }
    });

    const server = await startServer(true);

    try {
      const response = await fetch(`${server.baseUrl}/entry/user-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "opaque-once", page: "iframe" })
      });
      const payload = (await response.json()) as { pageData: any };

      assert.equal(response.status, 200);

      // Обе точки встраивания живут на одной странице: данные вкладки уходят в React вместе с остальными.
      const pageData = payload.pageData;
      assert.ok(pageData, "обмен токена должен отдавать данные страницы iframe");
      assert.equal(pageData.isAdmin, true);
      assert.equal(pageData.loyalty.state, "not-connected");
      assert.equal(pageData.loyalty.title, "Программа лояльности не подключена");
      assert.equal(typeof pageData.defaultLoyaltyProviderUrl, "string");
    } finally {
      await server.close();
    }
  });

  test("подключение передает настройки в Vendor API и не трогает статус решения", async () => {
    const updates: unknown[] = [];
    let statusUpdates = 0;

    LoyaltyVendorApiClient.prototype.updateLoyaltySettings = async (_appId, _accountId, data) => {
      updates.push(data);
      return { outcome: "ok", code: null, message: "" };
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
      const stored = await installations.load("app-1", "account-1");
      assert.notEqual(stored?.connectedAt, null);
      assert.equal(stored?.providerToken, "manual-token");
      assert.equal(stored?.pendingProviderToken, null);

      // Готовность решения определяется обязательными настройками, а не лояльностью.
      assert.equal(statusUpdates, 0);
    } finally {
      await server.close();
    }
  });

  test("явный отказ Vendor API удаляет ожидающий токен и не трогает действующее подключение", async () => {
    installations.save(connectedInstallation());
    LoyaltyVendorApiClient.prototype.updateLoyaltySettings = async () => ({
      outcome: "rejected",
      code: 2006,
      message: "Указаны данные программы лояльности для решения без поддержки loyaltyApi"
    });

    const server = await startServer(true);

    try {
      const response = await postConnect(server.baseUrl, {
        providerUrl: "https://tunnel.example/custom-loyalty",
        providerToken: "new-token",
        externalSearch: true
      });
      const stored = await installations.load("app-1", "account-1");

      assert.equal(response.status, 502);
      // Причина отказа Vendor API должна доезжать до пользователя, а не теряться в логах.
      const text = await response.text();
      assert.match(text, /2006/);
      assert.match(text, /loyaltyApi/);
      // МойСклад настройки не принял и продолжает ходить со старым токеном.
      assert.equal(stored?.providerToken, "current-token");
      assert.equal(stored?.externalSearch, false);
      assert.notEqual(stored?.connectedAt, null);
      assert.equal(stored?.pendingProviderToken, null);
    } finally {
      await server.close();
    }
  });

  test("при неизвестном исходе ожидающий токен остается рядом с действующим", async () => {
    installations.save(connectedInstallation());
    LoyaltyVendorApiClient.prototype.updateLoyaltySettings = async () => ({
      outcome: "unknown",
      code: null,
      message: "Не удалось обратиться к Vendor API: timeout"
    });

    const server = await startServer(true);

    try {
      const response = await postConnect(server.baseUrl, {
        providerUrl: "https://tunnel.example/custom-loyalty",
        providerToken: "new-token",
        externalSearch: true
      });
      const stored = await installations.load("app-1", "account-1");

      assert.equal(response.status, 502);
      assert.match(await response.text(), /Повторите подключение/);
      // МойСклад мог переключиться на новый токен, а мог и нет: провайдер принимает оба.
      assert.equal(stored?.providerToken, "current-token");
      assert.equal(stored?.pendingProviderToken, "new-token");
      assert.equal(stored?.pendingExternalSearch, true);
      assert.notEqual(stored?.connectedAt, null);

      // Другой токен до разрешения исхода не принимается; отказ повтора не теряет токен с неизвестным исходом.
      assert.equal((await postConnect(server.baseUrl, { providerUrl: "https://tunnel.example/custom-loyalty", providerToken: "third-token" })).status, 409);
      LoyaltyVendorApiClient.prototype.updateLoyaltySettings = async () => ({ outcome: "rejected", code: 2007, message: "Решение еще устанавливается" });
      assert.equal((await postConnect(server.baseUrl, { providerUrl: "https://tunnel.example/custom-loyalty", externalSearch: false })).status, 502);
      assert.equal((await installations.load("app-1", "account-1"))?.pendingProviderToken, "new-token");
      assert.equal((await installations.load("app-1", "account-1"))?.pendingExternalSearch, true);

      const sent: string[] = [];
      LoyaltyVendorApiClient.prototype.updateLoyaltySettings = async (_appId, _accountId, data) => {
        sent.push(data.token);
        return { outcome: "ok", code: null, message: "" };
      };
      assert.equal((await postConnect(server.baseUrl, { providerUrl: "https://tunnel.example/custom-loyalty" })).status, 200);
      assert.deepEqual(sent, ["new-token"]);
      assert.equal((await installations.load("app-1", "account-1"))?.providerToken, "new-token");
    } finally {
      await server.close();
    }
  });

  test("поздний ответ прежней попытки не затирает ожидающий токен новой", async () => {
    // Две попытки с одним токеном идут параллельно. После ответа первой начинается подключение с другим токеном,
    // и только потом приходит ответ второй: он не должен стереть токен, который МойСклад мог принять.
    const replies = holdVendorApiReplies();
    const server = await startServer(true);

    try {
      const first = postConnect(server.baseUrl, { providerToken: "token-a" });
      const second = postConnect(server.baseUrl, { providerToken: "token-a" });
      await replies.waitFor(2);

      replies.send(0, "ok");
      assert.equal((await first).status, 200);

      LoyaltyVendorApiClient.prototype.updateLoyaltySettings = async () => ({ outcome: "unknown", code: null, message: "timeout" });
      assert.equal((await postConnect(server.baseUrl, { providerToken: "token-b" })).status, 502);

      replies.send(1, "ok");
      assert.equal((await second).status, 200);
      const stored = await installations.load("app-1", "account-1");
      assert.equal(stored?.providerToken, "token-a");
      assert.equal(stored?.pendingProviderToken, "token-b");
    } finally {
      await server.close();
    }
  });

  test("токен, принятый МоимСкладом после отказа параллельной попытке, остается ожидающим", async () => {
    // Отказ первой попытке убрал общий ожидающий токен, но вторую МойСклад принял: провайдер обязан принимать ее токен.
    installations.save(connectedInstallation());
    const replies = holdVendorApiReplies();
    const server = await startServer(true);

    try {
      const first = postConnect(server.baseUrl, { providerToken: "token-a" });
      const second = postConnect(server.baseUrl, { providerToken: "token-a" });
      await replies.waitFor(2);

      replies.send(0, "rejected");
      assert.equal((await first).status, 502);
      replies.send(1, "ok");
      assert.equal((await second).status, 200);

      const stored = await installations.load("app-1", "account-1");
      assert.equal(stored?.providerToken, "current-token");
      assert.equal(stored?.pendingProviderToken, "token-a");
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
      assert.equal(await installations.load("app-1", "account-1"), null);
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

  function connectedInstallation(): LoyaltyInstallationData {
    return {
      appId: "app-1",
      accountId: "account-1",
      providerToken: "current-token",
      externalSearch: false,
      connectedAt: Date.now(),
      pendingProviderToken: null,
      pendingExternalSearch: false,
      updatedAt: 0
    };
  }

  function holdVendorApiReplies(): { waitFor: (count: number) => Promise<void>; send: (index: number, outcome: "ok" | "rejected") => void } {
    const replies: Array<(result: { outcome: "ok" | "rejected"; code: null; message: string }) => void> = [];
    LoyaltyVendorApiClient.prototype.updateLoyaltySettings = () => new Promise((resolve) => replies.push(resolve));

    return {
      waitFor: async (count) => {
        while (replies.length < count) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      },
      send: (index, outcome) => replies[index]!({ outcome, code: null, message: "" })
    };
  }

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
});
