import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app";
import { config } from "../src/lib/config/config";
import { AppInstance } from "../src/lib/domain/app-instance";
import { LoyaltyInstallation } from "../src/lib/domain/loyalty-installation";
import { buildVendorApiJwt } from "../src/lib/integrations/vendor-api";

test("подключение лояльности переживает приостановку и сбрасывается при удалении решения", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "loyalty-vendor-endpoint-test-"));
  const original = {
    appId: config.appId,
    appUid: config.appUid,
    secretKey: config.secretKey,
    encryptKey: config.encryptKey,
    appBaseUrl: config.appBaseUrl,
    sessionSecret: config.sessionSecret,
    dataDir: config.dataDir,
    appDbPath: config.appDbPath,
    trustProxy: config.trustProxy
  };

  Object.assign(config, {
    appId: "app-1",
    appUid: "vendor.demo",
    secretKey: "vendor-endpoint-test-secret",
    encryptKey: "ab".repeat(32),
    appBaseUrl: "https://demo.example",
    sessionSecret: "vendor-endpoint-session-secret-1234567890",
    dataDir: directory,
    appDbPath: path.join(directory, "app.sqlite"),
    trustProxy: 0
  });

  const server = http.createServer(createApp({ sessionCookieSecure: false }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const endpoint = "/vendor-endpoint/api/moysklad/vendor/1.0/apps/app-1/account-1";

  try {
    const installed = await vendorRequest(baseUrl, endpoint, "PUT", {
      cause: "Install",
      access: [{ access_token: "access-token" }]
    });
    assert.equal(installed.status, 200);
    assert.deepEqual(await installed.json(), { status: "SettingsRequired" });

    const installation = LoyaltyInstallation.create("app-1", "account-1");
    installation.externalSearch = true;
    installation.markConnected();
    installation.persist();
    const providerToken = installation.providerToken;

    const suspended = await vendorRequest(baseUrl, endpoint, "DELETE", { cause: "Suspend" });
    assert.equal(suspended.status, 200);
    // МойСклад только помечает настройки лояльности приостановленными, поэтому подключение остается.
    assert.notEqual(LoyaltyInstallation.load("app-1", "account-1")?.connectedAt, null);

    const resumed = await vendorRequest(baseUrl, endpoint, "PUT", {
      cause: "Resume",
      access: [{ access_token: "new-access-token" }]
    });
    assert.equal(resumed.status, 200);
    // Подключенная лояльность решение готовым не делает: обязательные настройки не заполнены.
    assert.deepEqual(await resumed.json(), { status: "SettingsRequired" });
    assert.notEqual(LoyaltyInstallation.load("app-1", "account-1")?.connectedAt, null);

    const uninstalled = await vendorRequest(baseUrl, endpoint, "DELETE", { cause: "Uninstall" });
    assert.equal(uninstalled.status, 200);
    assert.equal(AppInstance.load("app-1", "account-1").isInstalled(), false);

    // Настройки лояльности удалены на стороне МоегоСклада, но токен решение сохраняет.
    const afterUninstall = LoyaltyInstallation.load("app-1", "account-1");
    assert.equal(afterUninstall?.connectedAt, null);
    assert.equal(afterUninstall?.providerToken, providerToken);
    assert.equal(afterUninstall?.externalSearch, true);

    const reinstalled = await vendorRequest(baseUrl, endpoint, "PUT", {
      cause: "Install",
      access: [{ access_token: "reinstall-access-token" }]
    });
    assert.equal(reinstalled.status, 200);

    // После повторной установки настройки нужно передать заново, токен переиспользуется.
    const afterReinstall = LoyaltyInstallation.load("app-1", "account-1");
    assert.equal(afterReinstall?.connectedAt, null);
    assert.equal(afterReinstall?.providerToken, providerToken);

  } finally {
    server.close();
    await once(server, "close");
    Object.assign(config, original);
    rmSync(directory, { recursive: true, force: true });
  }
});

function vendorRequest(baseUrl: string, pathname: string, method: "PUT" | "DELETE", body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${buildVendorApiJwt()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
