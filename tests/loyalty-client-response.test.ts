import assert from "node:assert/strict";
import test from "node:test";
import { readLoyaltyConnectResponse } from "../src/features/entry/iframe/loyalty-response";

test("парсер ответа подключения разбирает JSON", async () => {
  const response = new Response(JSON.stringify({ message: "Loyalty API настроен" }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

  await assert.doesNotReject(async () => {
    const payload = await readLoyaltyConnectResponse(response);
    assert.deepEqual(payload, { message: "Loyalty API настроен" });
  });
});

test("парсер ответа подключения возвращает текст, если это не JSON", async () => {
  const response = new Response("Не удалось настроить Loyalty API", {
    status: 502,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });

  const payload = await readLoyaltyConnectResponse(response);
  assert.equal(payload, "Не удалось настроить Loyalty API");
});
