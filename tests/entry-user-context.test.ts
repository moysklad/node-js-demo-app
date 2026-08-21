import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test, { afterEach, beforeEach } from "node:test";
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { VendorApi } from "../src/lib/integrations/vendor-api";
import { createEntryRouter } from "../src/entry/router";

const originalExchange = VendorApi.prototype.exchangeUserContext;
const originalExpand = VendorApi.prototype.expandUserContext;

let sharedSession: Record<string, unknown>;

beforeEach(() => {
  sharedSession = {};
});

afterEach(() => {
  VendorApi.prototype.exchangeUserContext = originalExchange;
  VendorApi.prototype.expandUserContext = originalExpand;
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

async function postExchange(baseUrl: string, body: unknown): Promise<{ status: number; json: any }> {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      `${baseUrl}/entry/user-context/exchange`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload).toString() }
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
          resolve({ status: res.statusCode ?? 0, json });
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

test("обмен краткого контекста возвращает accountId/userId/userUid", async () => {
  VendorApi.prototype.exchangeUserContext = async () => ({
    ok: true,
    data: { accountId: "account-1", userId: "user-1", userUid: "user-1.moysklad" }
  });

  const server = await startTestServer();

  try {
    const response = await postExchange(server.baseUrl, { token: "opaque-token", mode: "user" });

    assert.equal(response.status, 200);
    assert.equal(response.json.mode, "user");
    assert.equal(response.json.accountId, "account-1");
    assert.equal(response.json.userUid, "user-1.moysklad");
  } finally {
    await server.close();
  }
});

test("пустой токен отклоняется с 400", async () => {
  const server = await startTestServer();

  try {
    const response = await postExchange(server.baseUrl, { token: "", mode: "user" });

    assert.equal(response.status, 400);
  } finally {
    await server.close();
  }
});

test("ошибка Zeus транслируется со статусом и кодом", async () => {
  VendorApi.prototype.exchangeUserContext = async () => ({ ok: false, status: 404, errorCode: "3007" });

  const server = await startTestServer();

  try {
    const response = await postExchange(server.baseUrl, { token: "used-token", mode: "user" });

    assert.equal(response.status, 404);
    assert.equal(response.json.code, "3007");
  } finally {
    await server.close();
  }
});

test("расширенный контекст поднимает сессию с contextNonce", async () => {
  VendorApi.prototype.expandUserContext = async () => ({
    ok: true,
    data: {
      uid: "user-1",
      shortFio: "Иван Иванов",
      accountId: "account-1",
      permissions: { admin: { view: "ALL" } }
    }
  });

  const server = await startTestServer();

  try {
    const response = await postExchange(server.baseUrl, { token: "opaque-token", mode: "expand" });

    assert.equal(response.status, 200);
    assert.equal(response.json.mode, "expand");
    assert.equal(response.json.isAdmin, true);
    assert.ok(typeof response.json.contextNonce === "string" && response.json.contextNonce.length > 0);
    assert.ok(sharedSession.userContext);
  } finally {
    await server.close();
  }
});
