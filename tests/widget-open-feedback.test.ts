import assert from "node:assert/strict";
import test from "node:test";
import type { WidgetOpenMessage } from "../frontend/src/lib/widget-sdk";
import { resolveOpenFeedbackDecision } from "../frontend/src/pages/WidgetPage/lib/open-feedback";

function makeOpenMessage(messageId?: number): WidgetOpenMessage {
  return {
    name: "Open",
    messageId,
    objectId: "object-1",
    extensionPoint: "document.customerorder.edit",
    displayMode: "expanded",
  };
}

test("resolveOpenFeedbackDecision остается idle без Open", () => {
  assert.deepEqual(
    resolveOpenFeedbackDecision({
      isContextLoading: false,
      latestOpenMessage: null,
      lastSentMessageId: null,
    }),
    { kind: "idle" }
  );
});

test("resolveOpenFeedbackDecision пропускает Open без messageId", () => {
  assert.deepEqual(
    resolveOpenFeedbackDecision({
      isContextLoading: false,
      latestOpenMessage: makeOpenMessage(),
      lastSentMessageId: null,
    }),
    { kind: "skip", reason: "missing-message-id" }
  );
});

test("resolveOpenFeedbackDecision ждет bootstrap для нового messageId", () => {
  assert.deepEqual(
    resolveOpenFeedbackDecision({
      isContextLoading: true,
      latestOpenMessage: makeOpenMessage(1),
      lastSentMessageId: null,
    }),
    { kind: "wait", messageId: 1 }
  );
});

test("resolveOpenFeedbackDecision отправляет openFeedback после загрузки context", () => {
  assert.deepEqual(
    resolveOpenFeedbackDecision({
      isContextLoading: false,
      latestOpenMessage: makeOpenMessage(2),
      lastSentMessageId: null,
    }),
    { kind: "send", messageId: 2 }
  );
});

test("resolveOpenFeedbackDecision не отправляет повторно тот же messageId", () => {
  assert.deepEqual(
    resolveOpenFeedbackDecision({
      isContextLoading: false,
      latestOpenMessage: makeOpenMessage(3),
      lastSentMessageId: 3,
    }),
    { kind: "skip", reason: "already-sent" }
  );
});
