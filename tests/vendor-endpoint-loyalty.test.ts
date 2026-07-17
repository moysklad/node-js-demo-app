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

test("loyalty lifecycle resumes and removes connection data according to the feature flag", async () => {
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
    loyaltyApiEnabled: config.loyaltyApiEnabled,
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
    loyaltyApiEnabled: true,
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

    LoyaltyInstallation.create("app-1", "account-1").persist();

    const suspended = await vendorRequest(baseUrl, endpoint, "DELETE", { cause: "Suspend" });
    assert.equal(suspended.status, 200);

    const resumed = await vendorRequest(baseUrl, endpoint, "PUT", {
      cause: "Resume",
      access: [{ access_token: "new-access-token" }]
    });
    assert.equal(resumed.status, 200);
    assert.deepEqual(await resumed.json(), { status: "Activated" });

    const uninstalled = await vendorRequest(baseUrl, endpoint, "DELETE", { cause: "Uninstall" });
    assert.equal(uninstalled.status, 200);
    assert.equal(LoyaltyInstallation.load("app-1", "account-1"), null);
    assert.equal(AppInstance.load("app-1", "account-1").isInstalled(), false);

    config.loyaltyApiEnabled = false;
    LoyaltyInstallation.create("app-1", "account-1").persist();

    const regularAppInstalled = await vendorRequest(baseUrl, endpoint, "PUT", {
      cause: "Install",
      access: [{ access_token: "regular-app-access-token" }]
    });
    assert.equal(regularAppInstalled.status, 200);

    const regularAppUninstalled = await vendorRequest(baseUrl, endpoint, "DELETE", { cause: "Uninstall" });
    assert.equal(regularAppUninstalled.status, 200);
    assert.ok(LoyaltyInstallation.load("app-1", "account-1"));
    assert.equal(AppInstance.load("app-1", "account-1").isInstalled(), false);
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
