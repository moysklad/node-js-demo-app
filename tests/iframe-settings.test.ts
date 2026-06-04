import assert from "node:assert/strict";
import test from "node:test";
import { applyUpdateSettingsResponse } from "../frontend/src/lib/iframe-settings";
import type { IframeContext, UpdateSettingsResponse } from "../frontend/src/lib/sdk";

function makeContext(): IframeContext {
  return {
    accountId: "account-1",
    appVersion: "1.0.0",
    contextNonce: "nonce-1",
    fio: "Иван Иванов",
    infoMessage: "старое сообщение",
    isAdmin: true,
    isSettingsRequired: true,
    store: "старый склад",
    storesValues: ["старый склад", "основной склад"],
    uid: "user-1",
  };
}

test("applyUpdateSettingsResponse берет нормализованные значения из ответа backend", () => {
  const payload: UpdateSettingsResponse = {
    message: "Настройки обновлены",
    status: {
      className: "status-ready",
      title: "РЕШЕНИЕ ГОТОВО К РАБОТЕ",
      showDetails: true,
      infoMessage: "нормализованное сообщение",
      store: "основной склад",
    },
  };

  const result = applyUpdateSettingsResponse(makeContext(), payload, "  draft message  ", "draft store");

  assert.equal(result.nextData.infoMessage, "нормализованное сообщение");
  assert.equal(result.nextData.store, "основной склад");
  assert.equal(result.nextData.isSettingsRequired, false);
  assert.equal(result.nextDraftMessage, "нормализованное сообщение");
  assert.equal(result.nextDraftStore, "основной склад");
});

test("applyUpdateSettingsResponse использует draft fallback, если backend не прислал статус", () => {
  const result = applyUpdateSettingsResponse(makeContext(), null, "draft message", "draft store");

  assert.equal(result.nextData.infoMessage, "draft message");
  assert.equal(result.nextData.store, "draft store");
  assert.equal(result.nextData.isSettingsRequired, true);
  assert.equal(result.nextDraftMessage, "draft message");
  assert.equal(result.nextDraftStore, "draft store");
});
