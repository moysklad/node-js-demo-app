import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test, { afterEach, beforeEach } from "node:test";
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { createEntryRouter } from "../src/entry/router";
import { AppInstance, AppStatus, type AppInstanceData, type AppInstanceRepository } from "../src/lib/domain/app-instance";
import { JsonApi } from "../src/lib/integrations/json-api";
import { VendorApi } from "../src/lib/integrations/vendor-api";
import { redactSensitiveLogData } from "../src/lib/observability/logger";

const originalExchange = VendorApi.prototype.exchangeUserContext;
const originalStoresNames = JsonApi.prototype.storesNames;
let sharedSession: Record<string, unknown>;

class MemoryAppRepository implements AppInstanceRepository {
  load(_appId: string, accountId: string): AppInstanceData | null {
    return {
      appId: "",
      accountId,
      infoMessage: "Добро пожаловать",
      store: "Основной склад",
      accessToken: "installation-access-token",
      status: AppStatus.ACTIVATED,
      updatedAt: 0
    };
  }

  save(): void {}
  delete(): void {}
}

beforeEach(() => {
  sharedSession = {};
  AppInstance.configureRepository(new MemoryAppRepository());
  JsonApi.prototype.storesNames = async () => ["Основной склад"];
});

afterEach(() => {
  VendorApi.prototype.exchangeUserContext = originalExchange;
  JsonApi.prototype.storesNames = originalStoresNames;
});

function sessionMiddleware(): RequestHandler {
  return (req, _res, next) => {
    (req as unknown as { session: Record<string, unknown> }).session = sharedSession;
    next();
  };
}

async function startTestServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware());
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

async function postUserContext(baseUrl: string, body: unknown): Promise<{ status: number; text: string; json: any }> {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      `${baseUrl}/entry/user-context`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload).toString()
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode ?? 0, text, json });
        });
      }
    );
    req.on("error", reject);
    req.end(payload);
  });
}

test("краткий контекст поднимает существующую сессию и не отдаёт токен в ответе", async () => {
  let exchangedToken = "";
  VendorApi.prototype.exchangeUserContext = async (token) => {
    exchangedToken = token;
    return {
      ok: true,
      data: {
        accountId: "account-1",
        userId: "user-id-1",
        userUid: "user-uid-1",
        role: "admin"
      }
    };
  };
  const server = await startTestServer();

  try {
    const response = await postUserContext(server.baseUrl, { token: "opaque-once" });
    const sessionContext = sharedSession.userContext as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(exchangedToken, "opaque-once");
    assert.equal(response.json.user.isAdmin, true);
    assert.equal(response.json.user.role, "admin");
    assert.ok(typeof response.json.contextNonce === "string" && response.json.contextNonce.length > 0);
    assert.equal(sessionContext.uid, "user-uid-1");
    assert.equal(sessionContext.accountId, "account-1");
    assert.equal(sessionContext.isAdmin, true);
    assert.equal(response.text.includes("opaque-once"), false);
  } finally {
    await server.close();
  }
});

test("пустой токен отклоняется до вызова Zeus", async () => {
  let calls = 0;
  VendorApi.prototype.exchangeUserContext = async () => {
    calls += 1;
    return { ok: false, status: 500, errorCode: null };
  };
  const server = await startTestServer();

  try {
    const response = await postUserContext(server.baseUrl, { token: "  " });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    await server.close();
  }
});

test("статус и безопасный код ошибки Zeus пробрасываются без тела ответа", async () => {
  VendorApi.prototype.exchangeUserContext = async () => ({
    ok: false,
    status: 422,
    errorCode: "3008"
  });
  const server = await startTestServer();

  try {
    const response = await postUserContext(server.baseUrl, { token: "expired-token" });
    assert.equal(response.status, 422);
    assert.deepEqual(response.json, {
      message: "Не удалось получить контекст пользователя",
      code: "3008"
    });
    assert.equal(response.text.includes("expired-token"), false);
  } finally {
    await server.close();
  }
});

test("поля с токеном рекурсивно маскируются во всех форматах логгера", () => {
  const token = "must-never-appear";
  const sanitized = redactSensitiveLogData({
    body: { token, nested: [{ access_token: token }] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const serialized = JSON.stringify(sanitized);

  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes("[REDACTED]"), true);
});
