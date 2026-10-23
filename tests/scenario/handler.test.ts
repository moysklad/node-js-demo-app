// Интеграционный тест: HTTP-маршруты приложения или SQLite.
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { createVendorEndpointRouter } from "../../src/api/vendor-endpoint";
import { config } from "../../src/lib/config/config";
import { AppInstance, AppStatus, type AppInstanceData, type AppInstanceRepository } from "../../src/lib/domain/app-instance";
import { JsonApi } from "../../src/lib/integrations/json-api";
import { JwtReplay, type JwtReplayRepository } from "../../src/lib/security/jwt-replay-repository";
import { LoyaltyInstallation, type LoyaltyInstallationRepository } from "../../src/loyalty/domain/loyalty-installation";
import { ScenarioEvent, SCENARIO_EVENTS_LIMIT, type ScenarioEventData, type ScenarioEventRepository } from "../../src/scenario/domain/scenario-event";

const secretKey = "test-secret-key";
const appId = "app-1";
const accountId = "account-1";
const scenarioPath = `/api/moysklad/vendor/1.0/apps/${appId}/${accountId}/scenario`;

class MemoryScenarioEventRepository implements ScenarioEventRepository {
  readonly rows: ScenarioEventData[] = [];

  save(event: ScenarioEventData): ScenarioEventData {
    const saved = { ...event, id: this.rows.length + 1, createdAt: event.createdAt || new Date().toISOString() };
    this.rows.push(saved);
    return saved;
  }

  listRecent(_appId: string, _accountId: string, limit = SCENARIO_EVENTS_LIMIT): ScenarioEventData[] {
    return [...this.rows].reverse().slice(0, limit);
  }
}

class MemoryAppRepository implements AppInstanceRepository {
  load(): AppInstanceData {
    return { appId, accountId, infoMessage: "", store: "Основной склад", accessToken: "access-token", status: AppStatus.ACTIVATED, updatedAt: 0 };
  }

  save(): void {}
  delete(): void {}
}

class MemoryJwtReplayRepository implements JwtReplayRepository {
  register(): boolean {
    return true;
  }
}

const originalSecretKey = config.secretKey;
const originalGetScenarioObject = JsonApi.prototype.getScenarioObject;
let events: MemoryScenarioEventRepository;

describe("Действия в сценариях", () => {
  beforeEach(() => {
    config.secretKey = secretKey;
    events = new MemoryScenarioEventRepository();
    ScenarioEvent.configureRepository(events);
    AppInstance.configureRepository(new MemoryAppRepository());
    LoyaltyInstallation.configureRepository({ load: () => null, findByToken: () => null, save() {}, delete() {} } as LoyaltyInstallationRepository);
    JwtReplay.configureRepository(new MemoryJwtReplayRepository());
  });

  afterEach(() => {
    config.secretKey = originalSecretKey;
    JsonApi.prototype.getScenarioObject = originalGetScenarioObject;
  });

  test("log-event отвечает 200 и пишет срабатывание в журнал", async () => {
    const server = await startServer();

    try {
      const response = await postScenario(server.baseUrl, action("log-event"));

      assert.equal(response.status, 200);
      assert.equal(response.text, "");
      assert.equal(events.rows.length, 1);
      assert.equal(events.rows[0]?.outcome, "ok");
      assert.equal(events.rows[0]?.actionType, "MODIFY");
      assert.equal(events.rows[0]?.objectType, "CustomerOrder");
    } finally {
      await server.close();
    }
  });

  test("fetch-object запрашивает объект по имени сущности JSON API, 502 отвечает только когда повтор поможет", async () => {
    const requested: string[] = [];
    const failures = [
      null,
      { kind: "http" as const, status: 429, body: null, message: "429" },
      { kind: "http" as const, status: 404, body: null, message: "404" }
    ];
    JsonApi.prototype.getScenarioObject = async (entity, objectId) => {
      requested.push(`${entity}/${objectId}`);
      const failure = failures[requested.length - 1] ?? null;
      return { data: failure ? null : { id: objectId, name: "00001" }, failure, retries: 0 };
    };
    const server = await startServer();

    try {
      const fetched = await postScenario(server.baseUrl, action("fetch-object"));
      const failed = await postScenario(server.baseUrl, action("fetch-object"));
      const notFound = await postScenario(server.baseUrl, { ...action("fetch-object"), objectType: "Company" });

      assert.equal(fetched.status, 200);
      assert.deepEqual(requested, ["customerorder/order-1", "customerorder/order-1", "counterparty/order-1"]);
      assert.equal(events.rows[0]?.objectName, "00001");
      assert.equal(events.rows[0]?.outcome, "ok");

      // 429 и 5xx — МойСклад повторит действие по политике retry.
      assert.equal(failed.status, 502);
      assert.equal(events.rows[1]?.outcome, "failed");

      // 4xx от JSON API повтором не лечится: 400 с сообщением для истории сценария.
      assert.equal(notFound.status, 400);
      assert.match(notFound.text, /404/);
      assert.equal(events.rows[2]?.outcome, "failed");
    } finally {
      await server.close();
    }
  });

  test("reject отвечает 400 с сообщением для истории выполнения сценария", async () => {
    const server = await startServer();

    try {
      const response = await postScenario(server.baseUrl, action("reject"));
      const body = JSON.parse(response.text) as { error: { code: number; errorMessage: string } };

      assert.equal(response.status, 400);
      assert.equal(body.error.code, 1001);
      assert.match(body.error.errorMessage, /CustomerOrder order-1/);
      assert.equal(events.rows[0]?.outcome, "rejected");
      assert.equal(events.rows[0]?.message, body.error.errorMessage);
    } finally {
      await server.close();
    }
  });

  test("неизвестное действие и неполный запрос отклоняются без записи в журнал", async () => {
    const server = await startServer();

    try {
      const unknown = await postScenario(server.baseUrl, action("unknown-action"));
      const incomplete = await postScenario(server.baseUrl, { actionName: "log-event" });

      assert.equal(unknown.status, 400);
      assert.match(JSON.parse(unknown.text).error.errorMessage, /unknown-action/);
      assert.equal(incomplete.status, 400);
      assert.equal(events.rows.length, 0);
    } finally {
      await server.close();
    }
  });

  test("без service JWT обработчик отвечает 401", async () => {
    const server = await startServer();

    try {
      const response = await fetch(`${server.baseUrl}${scenarioPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action("log-event"))
      });

      assert.equal(response.status, 401);
      assert.equal(events.rows.length, 0);
    } finally {
      await server.close();
    }
  });

  function action(actionName: string): Record<string, string> {
    return { actionName, actionType: "MODIFY", objectId: "order-1", objectType: "CustomerOrder" };
  }

  async function postScenario(baseUrl: string, body: unknown): Promise<{ status: number; text: string }> {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign({ iat: now, exp: now + 60, jti: `jti-${Math.random()}` }, secretKey, { algorithm: "HS256" });
    const response = await fetch(`${baseUrl}${scenarioPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });

    return { status: response.status, text: await response.text() };
  }

  async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
    const app = express();
    app.use(express.json());
    app.use(createVendorEndpointRouter());

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
