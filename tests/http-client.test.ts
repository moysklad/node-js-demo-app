import assert from "node:assert/strict";
import { once } from "node:events";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import { makeHttpRequest, makeHttpRequestDetailed } from "../src/lib/http/http-client";

type QueuedResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: string;
};

type TestServer = {
  baseUrl: string;
  calls: Array<{ method: string; url: string; authorization: string | undefined; calledAt: number }>;
  close: () => Promise<void>;
};

async function startQueuedServer(responses: QueuedResponse[]): Promise<TestServer> {
  const calls: TestServer["calls"] = [];
  const queue = [...responses];
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    calls.push({
      method: req.method ?? "",
      url: req.url ?? "",
      authorization: req.headers.authorization,
      calledAt: performance.now()
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

describe("HTTP-клиент", () => {
  test("GET повторяется после 429 с X-Lognex-Retry-After и считает повтор", async () => {
    const server = await startQueuedServer([
      {
        status: 429,
        headers: { "X-Lognex-Retry-After": "1" },
        body: "Слишком много запросов"
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [] })
      }
    ]);

    try {
      const result = await makeHttpRequestDetailed<{ rows: unknown[] }>(
        "GET",
        `${server.baseUrl}/entity/store`,
        "service-token"
      );

      assert.deepEqual(result.data, { rows: [] });
      assert.equal(result.failure, null);
      assert.equal(result.retries, 1);
      assert.deepEqual(server.calls.map((call) => call.method), ["GET", "GET"]);
      assert.equal(server.calls[0]?.authorization, "Bearer service-token");
    } finally {
      await server.close();
    }
  });

  test("Сплошные 429 прекращаются после исчерпания повторов", async () => {
    const server = await startQueuedServer([
      {
        status: 429,
        headers: { "X-Lognex-Retry-After": "1" },
        body: "Слишком много запросов"
      }
    ]);

    try {
      const result = await makeHttpRequestDetailed<{ rows: unknown[] }>(
        "GET",
        `${server.baseUrl}/entity/store`,
        "service-token"
      );

      assert.equal(result.data, null);
      assert.equal(result.failure?.status, 429);
      assert.equal(result.retries, 10);
      assert.equal(server.calls.length, 11);
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

  test("параллельные ретраи одного API и токена проходят через общий rate-limit gate", async () => {
    const rateLimitHeaders = {
      "X-Lognex-Retry-After": "20",
      "X-Lognex-Retry-TimeInterval": "160",
      "X-RateLimit-Limit": "2"
    };
    const server = await startQueuedServer([
      { status: 429, headers: rateLimitHeaders },
      { status: 429, headers: rateLimitHeaders },
      { status: 200, headers: { "Content-Type": "application/json" }, body: "{}" },
      { status: 200, headers: { "Content-Type": "application/json" }, body: "{}" }
    ]);

    try {
      const requestOptions = { serviceName: "json-api" };
      const url = `${server.baseUrl}/entity/store`;

      const results = await Promise.all([
        makeHttpRequest<Record<string, never>>("GET", url, "paced-token", null, requestOptions),
        makeHttpRequest<Record<string, never>>("GET", url, "paced-token", null, requestOptions)
      ]);

      assert.deepEqual(results, [{}, {}]);
      assert.equal(server.calls.length, 4);

      const firstRetryAt = server.calls[2]?.calledAt ?? 0;
      const secondRetryAt = server.calls[3]?.calledAt ?? 0;
      assert.ok(secondRetryAt - firstRetryAt >= 60, "общий gate должен разнести ретраи по времени");
    } finally {
      await server.close();
    }
  });

  test("rate-limit gate JSON API забывает простой дольше десяти минут", async () => {
    const originalNow = Date.now;
    let now = 1_000_000;
    Date.now = () => now;

    const rateLimitHeaders = {
      "X-Lognex-Retry-TimeInterval": "160",
      "X-RateLimit-Limit": "2"
    };
    const server = await startQueuedServer([
      { status: 200, headers: { "Content-Type": "application/json", ...rateLimitHeaders }, body: "{}" },
      { status: 200, headers: { "Content-Type": "application/json" }, body: "{}" },
      { status: 200, headers: { "Content-Type": "application/json" }, body: "{}" }
    ]);

    try {
      const requestOptions = { serviceName: "json-api" };
      const url = `${server.baseUrl}/entity/store`;

      await makeHttpRequest<Record<string, never>>("GET", url, "idle-token", null, requestOptions);
      now += 10 * 60 * 1000 + 1;

      await Promise.all([
        makeHttpRequest<Record<string, never>>("GET", url, "idle-token", null, requestOptions),
        makeHttpRequest<Record<string, never>>("GET", url, "idle-token", null, requestOptions)
      ]);

      const firstAfterIdle = server.calls[1]?.calledAt ?? 0;
      const secondAfterIdle = server.calls[2]?.calledAt ?? 0;
      assert.ok(
        secondAfterIdle - firstAfterIdle < 60,
        "после простоя gate не должен держать прежний pacing"
      );
    } finally {
      Date.now = originalNow;
      await server.close();
    }
  });
});
