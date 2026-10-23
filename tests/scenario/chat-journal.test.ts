// Интеграционный тест: HTTP-маршруты приложения или SQLite.
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, test } from "node:test";
import express, { type RequestHandler } from "express";
import { createEntryRouter } from "../../src/entry/router";
import { config } from "../../src/lib/config/config";
import { AppInstance, AppStatus, type AppInstanceData, type AppInstanceRepository } from "../../src/lib/domain/app-instance";
import { VendorApi } from "../../src/lib/integrations/vendor-api";
import { saveActiveUserContextToSession, USER_CONTEXT_SESSION_KEY } from "../../src/lib/session/user-context";
import { ScenarioEvent, type ScenarioEventData, type ScenarioEventRepository } from "../../src/scenario/domain/scenario-event";
import { createScenarioEventsRouter } from "../../src/scenario";

class MemoryScenarioEventRepository implements ScenarioEventRepository {
  constructor(private readonly rows: ScenarioEventData[]) {}

  save(event: ScenarioEventData): ScenarioEventData {
    return event;
  }

  listRecent(appId: string, accountId: string): ScenarioEventData[] {
    return this.rows.filter((row) => row.appId === appId && row.accountId === accountId);
  }
}

class MemoryAppRepository implements AppInstanceRepository {
  load(appId: string, accountId: string): AppInstanceData {
    return { appId, accountId, infoMessage: "Привет", store: "Основной склад", accessToken: "", status: AppStatus.ACTIVATED, updatedAt: 0 };
  }

  save(): void {}
  delete(): void {}
}

const originalAppId = config.appId;
const originalExchange = VendorApi.prototype.exchangeUserContext;
let session: Record<string, unknown>;

describe("Окно чатов и журнал действий", () => {
  beforeEach(() => {
    config.appId = "app-1";
    session = {};
    AppInstance.configureRepository(new MemoryAppRepository());
    ScenarioEvent.configureRepository(new MemoryScenarioEventRepository([
      storedEvent("account-1", "log-event", "ok"),
      storedEvent("account-2", "reject", "rejected")
    ]));
  });

  afterEach(() => {
    config.appId = originalAppId;
    VendorApi.prototype.exchangeUserContext = originalExchange;
  });

  test("страница окна чатов отдается без персональных данных с бандлом chat", async () => {
    const server = await startServer();

    try {
      const response = await fetch(`${server.baseUrl}/entry/iframe-chat`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /\/assets\/entry\/chat\.js/);
      assert.equal(html.includes("page-data"), false);
    } finally {
      await server.close();
    }
  });

  test("обмен токена с page: chat отдает состояние решения и журнал только своего аккаунта", async () => {
    VendorApi.prototype.exchangeUserContext = async () => ({
      ok: true,
      data: { accountId: "account-1", userId: "user-id-1", userUid: "user-1", role: "cashier" }
    });
    const server = await startServer();

    try {
      const response = await fetch(`${server.baseUrl}/entry/user-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "opaque-once", page: "chat" })
      });
      const payload = (await response.json()) as { pageData: any };

      assert.equal(response.status, 200);
      // Окно видно всем пользователям аккаунта, не только администратору.
      assert.equal(payload.pageData.isAdmin, false);
      assert.equal(payload.pageData.status.title, "Решение готово к работе");
      assert.equal(payload.pageData.scenarioActions.length, 3);
      assert.equal(payload.pageData.scenarioEvents.length, 1);
      assert.equal(payload.pageData.scenarioEvents[0].actionTitle, "Записать событие в журнал решения");
      assert.equal("storesValues" in payload.pageData, false);
    } finally {
      await server.close();
    }
  });

  test("журнал обновляется по contextNonce, без него отвечает 401", async () => {
    const server = await startServer();

    try {
      const unauthorized = await fetch(`${server.baseUrl}/utils/scenario-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      assert.equal(unauthorized.status, 401);

      saveActiveUserContextToSession(
        { session } as unknown as Parameters<typeof saveActiveUserContextToSession>[0],
        { uid: "user-1", fio: "", accountId: "account-1", isAdmin: false }
      );
      const contextNonce = (session[USER_CONTEXT_SESSION_KEY] as { contextNonce: string }).contextNonce;
      const response = await fetch(`${server.baseUrl}/utils/scenario-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextNonce })
      });
      const payload = (await response.json()) as { scenarioEvents: Array<{ actionName: string }> };

      assert.equal(response.status, 200);
      assert.deepEqual(payload.scenarioEvents.map((event) => event.actionName), ["log-event"]);
    } finally {
      await server.close();
    }
  });

  function storedEvent(accountId: string, actionName: string, outcome: ScenarioEventData["outcome"]): ScenarioEventData {
    return {
      id: 1,
      appId: "app-1",
      accountId,
      actionName,
      actionType: "MODIFY",
      objectType: "CustomerOrder",
      objectId: "order-1",
      objectName: "",
      outcome,
      message: "",
      createdAt: "2026-10-15T10:00:00.000Z"
    };
  }

  async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
    const app = express();
    app.use(express.json());
    app.use(((req, _res, next) => {
      (req as unknown as { session: Record<string, unknown> }).session = session;
      next();
    }) as RequestHandler);
    app.use("/entry", createEntryRouter());
    app.use("/utils", createScenarioEventsRouter());

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
});
