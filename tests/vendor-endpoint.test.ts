import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { createVendorEndpointRouter } from "../src/api/vendor-endpoint";
import { config } from "../src/lib/config/config";
import { AppInstance, AppStatus, type AppInstanceData, type AppInstanceRepository } from "../src/lib/domain/app-instance";
import {
  LoyaltyInstallation,
  type LoyaltyInstallationData,
  type LoyaltyInstallationRepository
} from "../src/lib/domain/loyalty-installation";
import { JwtReplay, type JwtReplayRepository } from "../src/lib/security/jwt-replay-repository";

const secretKey = "test-secret-key";
const appId = "app-1";
const accountId = "account-1";
const appPath = `/api/moysklad/vendor/1.0/apps/${appId}/${accountId}`;

class MemoryAppInstanceRepository implements AppInstanceRepository {
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
    this.rows.set(this.key(data.appId, data.accountId), data);
  }

  delete(appId: string, accountId: string): void {
    this.rows.delete(this.key(appId, accountId));
  }

  private key(appId: string, accountId: string): string {
    return `${appId}:${accountId}`;
  }
}

class MemoryLoyaltyInstallationRepository implements LoyaltyInstallationRepository {
  private readonly rows = new Map<string, LoyaltyInstallationData>();

  constructor(initialRows: LoyaltyInstallationData[] = []) {
    for (const row of initialRows) {
      this.rows.set(this.key(row.appId, row.accountId), row);
    }
  }

  load(appId: string, accountId: string): LoyaltyInstallationData | null {
    return this.rows.get(this.key(appId, accountId)) ?? null;
  }

  findByToken(token: string): LoyaltyInstallationData | null {
    return [...this.rows.values()].find((row) => row.providerToken === token) ?? null;
  }

  save(data: LoyaltyInstallationData): void {
    this.rows.set(this.key(data.appId, data.accountId), data);
  }

  delete(appId: string, accountId: string): void {
    this.rows.delete(this.key(appId, accountId));
  }

  private key(appId: string, accountId: string): string {
    return `${appId}:${accountId}`;
  }
}

class MemoryJwtReplayRepository implements JwtReplayRepository {
  private readonly used = new Set<string>();

  register(jti: string): boolean {
    if (this.used.has(jti)) {
      return false;
    }

    this.used.add(jti);
    return true;
  }
}

type TestResponse = {
  status: number;
  text: string;
};

function configureRepositories(
  initialRow: AppInstanceData,
  loyaltyRows: LoyaltyInstallationData[] = []
): { apps: MemoryAppInstanceRepository; loyalty: MemoryLoyaltyInstallationRepository } {
  const apps = new MemoryAppInstanceRepository([initialRow]);
  const loyalty = new MemoryLoyaltyInstallationRepository(loyaltyRows);

  config.secretKey = secretKey;
  AppInstance.configureRepository(apps);
  LoyaltyInstallation.configureRepository(loyalty);
  JwtReplay.configureRepository(new MemoryJwtReplayRepository());

  return { apps, loyalty };
}

function connectedLoyaltyRow(): LoyaltyInstallationData {
  return {
    appId,
    accountId,
    providerToken: "provider-token",
    externalSearch: true,
    connectedAt: Date.now(),
    updatedAt: 0
  };
}

function activatedRow(): AppInstanceData {
  return {
    appId,
    accountId,
    infoMessage: "Сообщение",
    store: "Основной склад",
    accessToken: "access-token",
    status: AppStatus.ACTIVATED,
    updatedAt: 0
  };
}

function authHeader(jti: string): Record<string, string> {
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign({ iat: now, exp: now + 60, jti }, secretKey, { algorithm: "HS256" });

  return { Authorization: `Bearer ${token}` };
}

async function startTestServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
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

async function request(
  url: string,
  options: { method: "PUT" | "DELETE"; jti: string; body: unknown }
): Promise<TestResponse> {
  const body = JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body).toString(),
          ...authHeader(options.jti)
        }
      },
      (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf-8") });
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

test("Suspend сохраняет настройки, Resume возвращает решение в работу", async () => {
  const { apps: repository } = configureRepositories(activatedRow());
  const server = await startTestServer();

  try {
    const suspendResponse = await request(`${server.baseUrl}${appPath}`, {
      method: "DELETE",
      jti: "jti-suspend",
      body: { cause: "Suspend" }
    });
    const suspended = repository.load(appId, accountId);

    const resumeResponse = await request(`${server.baseUrl}${appPath}`, {
      method: "PUT",
      jti: "jti-resume",
      body: { cause: "Resume", access: [{ access_token: "access-token-2" }] }
    });
    const resumed = repository.load(appId, accountId);

    assert.equal(suspendResponse.status, 200);
    assert.equal(suspended?.status, AppStatus.SUSPENDED);
    assert.equal(suspended?.accessToken, "");
    assert.equal(suspended?.store, "Основной склад");

    assert.equal(resumeResponse.status, 200);
    assert.deepEqual(JSON.parse(resumeResponse.text), { status: "Activated" });
    assert.equal(resumed?.status, AppStatus.ACTIVATED);
    assert.equal(resumed?.accessToken, "access-token-2");
  } finally {
    await server.close();
  }
});

test("Uninstall сохраняет настройки, повторная установка не требует настройки решения", async () => {
  const { apps: repository } = configureRepositories(activatedRow());
  const server = await startTestServer();

  try {
    const uninstallResponse = await request(`${server.baseUrl}${appPath}`, {
      method: "DELETE",
      jti: "jti-uninstall-1",
      body: { cause: "Uninstall" }
    });
    const uninstalled = repository.load(appId, accountId);

    const repeatedUninstallResponse = await request(`${server.baseUrl}${appPath}`, {
      method: "DELETE",
      jti: "jti-uninstall-2",
      body: { cause: "Uninstall" }
    });

    const installResponse = await request(`${server.baseUrl}${appPath}`, {
      method: "PUT",
      jti: "jti-install",
      body: { cause: "Install", access: [{ access_token: "access-token-3" }] }
    });
    const reinstalled = repository.load(appId, accountId);

    assert.equal(uninstallResponse.status, 200);
    assert.equal(uninstalled?.status, AppStatus.UNINSTALLED);
    assert.equal(uninstalled?.accessToken, "");
    assert.equal(uninstalled?.store, "Основной склад");

    assert.equal(repeatedUninstallResponse.status, 204);

    assert.equal(installResponse.status, 200);
    assert.deepEqual(JSON.parse(installResponse.text), { status: "Activated" });
    assert.equal(reinstalled?.status, AppStatus.ACTIVATED);
    assert.equal(reinstalled?.accessToken, "access-token-3");
  } finally {
    await server.close();
  }
});

test("установка без сохраненных настроек требует настройки решения", async () => {
  const { apps: repository } = configureRepositories({ ...activatedRow(), store: "", status: AppStatus.UNKNOWN });
  const server = await startTestServer();

  try {
    const installResponse = await request(`${server.baseUrl}${appPath}`, {
      method: "PUT",
      jti: "jti-install-clean",
      body: { cause: "Install", access: [{ access_token: "access-token-4" }] }
    });

    assert.equal(installResponse.status, 200);
    assert.deepEqual(JSON.parse(installResponse.text), { status: "SettingsRequired" });
    assert.equal(repository.load(appId, accountId)?.status, AppStatus.SETTINGS_REQUIRED);
  } finally {
    await server.close();
  }
});

test("Suspend сохраняет подключение лояльности, Uninstall сбрасывает его, оставляя токен", async () => {
  const { loyalty } = configureRepositories(activatedRow(), [connectedLoyaltyRow()]);
  const server = await startTestServer();

  try {
    // Приостановка решения настройки лояльности в МоемСкладе не удаляет.
    await request(`${server.baseUrl}${appPath}`, {
      method: "DELETE",
      jti: "jti-loyalty-suspend",
      body: { cause: "Suspend" }
    });
    const afterSuspend = loyalty.load(appId, accountId);

    await request(`${server.baseUrl}${appPath}`, {
      method: "PUT",
      jti: "jti-loyalty-resume",
      body: { cause: "Resume", access: [{ access_token: "access-token-2" }] }
    });
    const afterResume = loyalty.load(appId, accountId);

    // А вот удаление решения стирает их на стороне МоегоСклада, поэтому подключать нужно заново.
    await request(`${server.baseUrl}${appPath}`, {
      method: "DELETE",
      jti: "jti-loyalty-uninstall",
      body: { cause: "Uninstall" }
    });
    const afterUninstall = loyalty.load(appId, accountId);

    assert.notEqual(afterSuspend?.connectedAt, null);
    assert.notEqual(afterResume?.connectedAt, null);

    assert.equal(afterUninstall?.connectedAt, null);
    assert.equal(afterUninstall?.providerToken, "provider-token");
    assert.equal(afterUninstall?.externalSearch, true);
  } finally {
    await server.close();
  }
});

test("повторная установка требует заново передать настройки лояльности", async () => {
  const { loyalty } = configureRepositories(activatedRow(), [connectedLoyaltyRow()]);
  const server = await startTestServer();

  try {
    const installResponse = await request(`${server.baseUrl}${appPath}`, {
      method: "PUT",
      jti: "jti-loyalty-install",
      body: { cause: "Install", access: [{ access_token: "access-token-5" }] }
    });
    const installed = loyalty.load(appId, accountId);

    // Само решение готово к работе: обязательные настройки лояльности не касаются.
    assert.equal(installResponse.status, 200);
    assert.deepEqual(JSON.parse(installResponse.text), { status: "Activated" });

    assert.equal(installed?.connectedAt, null);
    assert.equal(installed?.providerToken, "provider-token");
  } finally {
    await server.close();
  }
});
