import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test, { afterEach, beforeEach } from "node:test";
import express, { type RequestHandler } from "express";
import { createEntryRouter } from "../src/entry/router";
import { config } from "../src/lib/config/config";
import { Loyalty, type LoyaltyRepository, type LoyaltySettingsData } from "../src/lib/domain/loyalty";
import { VendorApi } from "../src/lib/integrations/vendor-api";
import { saveActiveUserContextToSession } from "../src/lib/session/user-context";

class MemoryLoyaltyRepository implements LoyaltyRepository {
  private readonly rows = new Map<string, LoyaltySettingsData>();

  load(appId: string, accountId: string): LoyaltySettingsData | null {
    return this.rows.get(`${appId}:${accountId}`) ?? null;
  }

  save(data: LoyaltySettingsData): void {
    this.rows.set(`${data.appId}:${data.accountId}`, data);
  }

  delete(appId: string, accountId: string): void {
    this.rows.delete(`${appId}:${accountId}`);
  }
}

const originalAppId = config.appId;
const originalUpdate = VendorApi.prototype.updateLoyaltySettings;
const originalPatch = VendorApi.prototype.updateLoyaltySettingsPartially;
let session: Record<string, unknown>;

beforeEach(() => {
  config.appId = "app-1";
  session = {};
  Loyalty.configureRepository(new MemoryLoyaltyRepository());
});

afterEach(() => {
  config.appId = originalAppId;
  VendorApi.prototype.updateLoyaltySettings = originalUpdate;
  VendorApi.prototype.updateLoyaltySettingsPartially = originalPatch;
});

test("iframe proxy forwards valid PUT/PATCH and persists after success", async () => {
  const fullUpdates: unknown[] = [];
  const partialUpdates: unknown[] = [];
  VendorApi.prototype.updateLoyaltySettings = async (_appId, _accountId, data) => {
    fullUpdates.push(data);
    return true;
  };
  VendorApi.prototype.updateLoyaltySettingsPartially = async (_appId, _accountId, data) => {
    partialUpdates.push(data);
    return true;
  };

  const server = await startServer(true);
  try {
    const put = await request(server.baseUrl, "PUT", {
      url: "https://demo.example/loyalty",
      token: "provider-token",
      externalSearch: true
    });
    const patch = await request(server.baseUrl, "PATCH", { externalSearch: false });

    assert.equal(put.status, 200);
    assert.equal(patch.status, 200);
    assert.deepEqual(fullUpdates, [{
      url: "https://demo.example/loyalty",
      token: "provider-token",
      externalSearch: true
    }]);
    assert.deepEqual(partialUpdates, [{ externalSearch: false }]);
    assert.equal(Loyalty.load("app-1", "account-1").loyaltyExternalCustomers, false);
  } finally {
    await server.close();
  }
});

test("iframe proxy rejects incomplete payload before Vendor API", async () => {
  let calls = 0;
  VendorApi.prototype.updateLoyaltySettings = async () => {
    calls += 1;
    return true;
  };

  const server = await startServer(true);
  try {
    const response = await request(server.baseUrl, "PUT", {
      url: "https://demo.example/loyalty",
      externalSearch: true
    });

    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    await server.close();
  }
});

test("iframe proxy rejects loyalty updates from non-admin users", async () => {
  let calls = 0;
  VendorApi.prototype.updateLoyaltySettings = async () => {
    calls += 1;
    return true;
  };

  const server = await startServer(false);
  try {
    const response = await request(server.baseUrl, "PUT", {
      url: "https://demo.example/loyalty",
      token: "provider-token",
      externalSearch: true
    });

    assert.equal(response.status, 403);
    assert.equal(calls, 0);
  } finally {
    await server.close();
  }
});

async function startServer(isAdmin: boolean): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  saveActiveUserContextToSession(
    { session } as unknown as Parameters<typeof saveActiveUserContextToSession>[0],
    {
      uid: "user-1",
      fio: "Пользователь",
      accountId: "account-1",
      isAdmin
    }
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

async function request(baseUrl: string, method: "PUT" | "PATCH", body: unknown): Promise<{ status: number }> {
  const response = await fetch(`${baseUrl}/entry/vendor-api/loyalty`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return { status: response.status };
}
