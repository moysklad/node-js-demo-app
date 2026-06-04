import assert from "node:assert/strict";
import { once } from "node:events";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { makeHttpRequest } from "../backend/src/lib/http/http-client";

type QueuedResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: string;
};

type TestServer = {
  baseUrl: string;
  calls: Array<{ method: string; url: string; authorization: string | undefined }>;
  close: () => Promise<void>;
};

async function startQueuedServer(responses: QueuedResponse[]): Promise<TestServer> {
  const calls: TestServer["calls"] = [];
  const queue = [...responses];
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    calls.push({
      method: req.method ?? "",
      url: req.url ?? "",
      authorization: req.headers.authorization
    });

    const response = queue.shift() ?? responses.at(-1) ?? { status: 500, body: "" };

    res.writeHead(response.status, response.headers);
    res.end(response.body ?? "");
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    calls,
    close: async () => {
      server.close();
      await once(server, "close");
    }
  };
}

test("GET повторяется после 429 с X-Lognex-Retry-After", async () => {
  const server = await startQueuedServer([
    {
      status: 429,
      headers: { "X-Lognex-Retry-After": "1" },
      body: "Слишком много запросов"
    },
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Повтор успешен" })
    }
  ]);

  try {
    const result = await makeHttpRequest<{ message: string }>(
      "GET",
      `${server.baseUrl}/entity/customerorder`,
      "service-token"
    );

    assert.deepEqual(result, { message: "Повтор успешен" });
    assert.deepEqual(server.calls.map((call) => call.method), ["GET", "GET"]);
    assert.equal(server.calls[0]?.authorization, "Bearer service-token");
  } finally {
    await server.close();
  }
});

test("POST не становится retryable из-за X-Lognex-Retry-After", async () => {
  const server = await startQueuedServer([
    {
      status: 429,
      headers: { "X-Lognex-Retry-After": "1" },
      body: "Слишком много запросов"
    },
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Не должен вызываться" })
    }
  ]);

  try {
    const result = await makeHttpRequest<{ message: string }>(
      "POST",
      `${server.baseUrl}/context/context-key`,
      "service-token",
      {}
    );

    assert.equal(result, null);
    assert.deepEqual(server.calls.map((call) => call.method), ["POST"]);
  } finally {
    await server.close();
  }
});
