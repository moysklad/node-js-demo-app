import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test, { afterEach, beforeEach } from "node:test";
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { AppInstance, AppStatus, type AppInstanceData, type AppInstanceRepository } from "../src/lib/domain/app-instance";
import { JsonApi } from "../src/lib/integrations/json-api";
import { VendorApi } from "../src/lib/integrations/vendor-api";
import { saveActiveUserContextToSession, type UserContextSessionEntry } from "../src/lib/session/user-context";
import { createUtilsRouter } from "../src/utils/router";

class MemoryAppInstanceRepository implements AppInstanceRepository {
  readonly saved: AppInstanceData[] = [];
  private readonly rows = new Map<string, AppInstanceData>();

  constructor(initialRows: AppInstanceData[] = []) {
    for (const row of initialRows) {
      this.rows.set(this.key(row.appId, row.accountId), row);
    }
  }

  load(appId: string, accountId: string): AppInstanceData | null {
    return this.rows.get(this.key(appId, accountId)) ?? null;
  }

  save(data: AppInstanceData): void {
    this.saved.push(data);
    this.rows.set(this.key(data.appId, data.accountId), data);
  }

  delete(appId: string, accountId: string): void {
    this.rows.delete(this.key(appId, accountId));
  }

  private key(appId: string, accountId: string): string {
    return `${appId}:${accountId}`;
  }
}

type TestServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

type TestResponse = {
  status: number;
  text: string;
};

const originalGetObject = JsonApi.prototype.getObject;
const originalUpdateAppStatus = VendorApi.prototype.updateAppStatus;

let sharedSession: Record<string, unknown>;

beforeEach(() => {
  sharedSession = {};
});

afterEach(() => {
  JsonApi.prototype.getObject = originalGetObject;
  VendorApi.prototype.updateAppStatus = originalUpdateAppStatus;
});

function sessionMiddleware(): RequestHandler {
  return (req, _res, next) => {
    (req as unknown as { session: Record<string, unknown> }).session = sharedSession;
    next();
  };
}

async function startTestServer(): Promise<TestServer> {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(sessionMiddleware());
  app.use("/utils", createUtilsRouter());

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

async function request(
  url: string,
  options: {
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method,
      headers: {
        ...(options.body ? { "Content-Length": Buffer.byteLength(options.body).toString() } : {}),
        ...options.headers
      }
    }, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          text: Buffer.concat(chunks).toString("utf-8")
        });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

function seedContext(isAdmin: boolean): UserContextSessionEntry {
  return saveActiveUserContextToSession(
    { session: sharedSession } as unknown as Parameters<typeof saveActiveUserContextToSession>[0],
    {
      uid: "user-1",
      fio: "Иван Иванов",
      accountId: "account-1",
      isAdmin
    }
  );
}

function configureAppRepository(): MemoryAppInstanceRepository {
  const repository = new MemoryAppInstanceRepository([
    {
      appId: "",
      accountId: "account-1",
      infoMessage: "",
      store: "",
      accessToken: "access-token",
      status: AppStatus.SETTINGS_REQUIRED,
      updatedAt: 0
    }
  ]);

  AppInstance.configureRepository(repository);
  return repository;
}

test("get-object отклоняет старый контракт с contextKey", async () => {
  configureAppRepository();
  seedContext(true);
  let getObjectCalls = 0;

  JsonApi.prototype.getObject = async () => {
    getObjectCalls += 1;
    return { name: "Заказ 1" };
  };

  const server = await startTestServer();

  try {
    const response = await request(`${server.baseUrl}/utils/get-object?entity=customerorder&contextKey=legacy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectId: "object-1" })
    });

    assert.equal(response.status, 401);
    assert.equal(getObjectCalls, 0);
  } finally {
    await server.close();
  }
});

test("get-object принимает contextNonce и objectId из JSON body", async () => {
  configureAppRepository();
  const context = seedContext(true);
  const calls: Array<{ entity: string; objectId: string }> = [];

  JsonApi.prototype.getObject = async (entity: string, objectId: string) => {
    calls.push({ entity, objectId });
    return { name: "Заказ 1" };
  };

  const server = await startTestServer();

  try {
    const response = await request(`${server.baseUrl}/utils/get-object?entity=customerorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextNonce: context.contextNonce, objectId: "object-1" })
    });

    assert.equal(response.status, 200);
    assert.equal(response.text, "Заказ покупателя Заказ 1");
    assert.deepEqual(calls, [{ entity: "customerorder", objectId: "object-1" }]);
  } finally {
    await server.close();
  }
});

test("update-settings требует совпадающий nonce и контекст администратора", async () => {
  const repository = configureAppRepository();
  const userContext = seedContext(false);
  let statusUpdateCalls = 0;

  VendorApi.prototype.updateAppStatus = async () => {
    statusUpdateCalls += 1;
    return { status: "Activated" };
  };

  const server = await startTestServer();

  try {
    const forbidden = await request(`${server.baseUrl}/utils/update-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        contextNonce: userContext.contextNonce,
        infoMessage: "Привет из теста",
        store: "Основной склад"
      }).toString()
    });

    assert.equal(forbidden.status, 403);
    assert.equal(statusUpdateCalls, 0);

    const adminContext = seedContext(true);
    const ok = await request(`${server.baseUrl}/utils/update-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        contextNonce: adminContext.contextNonce,
        infoMessage: "Привет из теста",
        store: "Основной склад"
      }).toString()
    });

    assert.equal(ok.status, 200);
    assert.deepEqual(JSON.parse(ok.text), {
      message: "Настройки обновлены",
      status: {
        className: "status-ready",
        title: "РЕШЕНИЕ ГОТОВО К РАБОТЕ",
        showDetails: true,
        infoMessage: "Привет из теста",
        store: "Основной склад"
      }
    });
    assert.equal(statusUpdateCalls, 1);
    assert.equal(repository.saved.at(-1)?.infoMessage, "Привет из теста");
    assert.equal(repository.saved.at(-1)?.store, "Основной склад");
    assert.equal(repository.saved.at(-1)?.status, AppStatus.ACTIVATED);
  } finally {
    await server.close();
  }
});

test("update-settings возвращает статус с требованием настройки, если склад не выбран", async () => {
  const repository = configureAppRepository();
  const adminContext = seedContext(true);

  VendorApi.prototype.updateAppStatus = async () => ({ status: "SettingsRequired" });

  const server = await startTestServer();

  try {
    const response = await request(`${server.baseUrl}/utils/update-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        contextNonce: adminContext.contextNonce,
        infoMessage: "Нужно выбрать склад",
        store: "   "
      }).toString()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.text), {
      message: "Настройки обновлены",
      status: {
        className: "status-required",
        title: "ТРЕБУЕТСЯ НАСТРОЙКА",
        showDetails: false,
        infoMessage: "Нужно выбрать склад",
        store: ""
      }
    });
    assert.equal(repository.saved.at(-1)?.status, AppStatus.SETTINGS_REQUIRED);
  } finally {
    await server.close();
  }
});
