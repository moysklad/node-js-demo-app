import assert from "node:assert/strict";
import { once } from "node:events";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { config } from "../../src/lib/config/config";
import { LoyaltyVendorApiClient } from "../../src/loyalty/vendor-api";

test("Vendor API возвращает причину отказа с подсказкой", async () => {
  const server = http.createServer((_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      errors: [{ error: "Указаны данные программы лояльности для решения без поддержки loyaltyApi", code: 2006 }]
    }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  const originalEndpoint = config.moyskladVendorApiEndpointUrl;
  const originalAppUid = config.appUid;
  const originalSecretKey = config.secretKey;
  config.moyskladVendorApiEndpointUrl = `http://127.0.0.1:${address.port}`;
  config.appUid = "vendor.demo";
  config.secretKey = "loyalty-test-secret";

  try {
    const result = await new LoyaltyVendorApiClient().updateLoyaltySettings("app-id", "account-id", {
      url: "https://demo.example/loyalty",
      token: "provider-token",
      externalSearch: false
    });

    // 4xx с errors — явный отказ: настройки точно не применились.
    assert.equal(result.outcome, "rejected");
    assert.equal(result.code, 2006);
    // Пользователю нужен не только текст МоегоСклада, но и что с этим делать.
    assert.match(result.message, /без поддержки loyaltyApi/);
    assert.match(result.message, /дескриптор/);
  } finally {
    config.moyskladVendorApiEndpointUrl = originalEndpoint;
    config.appUid = originalAppUid;
    config.secretKey = originalSecretKey;
    server.close();
    await once(server, "close");
  }
});
