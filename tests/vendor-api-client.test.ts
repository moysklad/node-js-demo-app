import assert from "node:assert/strict";
import { once } from "node:events";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import jwt from "jsonwebtoken";
import { config } from "../src/lib/config/config";
import { VendorApi } from "../src/lib/integrations/vendor-api";

type RecordedCall = {
  method: string;
  url: string;
  authorization: string;
  contentType: string;
  body: unknown;
};

test("Vendor API отправляет настройки loyalty через PUT", async () => {
  const calls: RecordedCall[] = [];
  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks).toString("utf8");
    calls.push({
      method: req.method ?? "",
      url: req.url ?? "",
      authorization: req.headers.authorization ?? "",
      contentType: req.headers["content-type"] ?? "",
      body: rawBody ? JSON.parse(rawBody) : null
    });

    res.writeHead(200);
    res.end();
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
    const api = new VendorApi();
    assert.equal(
      await api.updateLoyaltySettings("app-id", "account-id", {
        url: "https://demo.example/loyalty",
        token: "provider-token",
        externalSearch: false
      }),
      true
    );
    assert.deepEqual(
      calls.map(({ method, url, contentType, body }) => ({ method, url, contentType, body })),
      [
        {
          method: "PUT",
          url: "/apps/app-id/account-id/loyalty",
          contentType: "application/json",
          body: {
            url: "https://demo.example/loyalty",
            token: "provider-token",
            externalSearch: false
          }
        }
      ]
    );

    for (const call of calls) {
      assert.match(call.authorization, /^Bearer /);
      jwt.verify(call.authorization.slice("Bearer ".length), config.secretKey, { algorithms: ["HS256"] });
    }
  } finally {
    config.moyskladVendorApiEndpointUrl = originalEndpoint;
    config.appUid = originalAppUid;
    config.secretKey = originalSecretKey;
    server.close();
    await once(server, "close");
  }
});
