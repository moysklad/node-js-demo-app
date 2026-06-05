import assert from "node:assert/strict";
import test from "node:test";
import type { WidgetOpenMessage } from "../frontend/src/lib/widget-sdk";
import {
  getBufferedOpenMessage,
  installOpenMessageBuffer,
  isWidgetOpenMessage,
  setBufferedOpenMessage,
  type OpenMessageBufferHost,
} from "../frontend/src/lib/open-message-buffer";

function makeOpenMessage(messageId = 1): WidgetOpenMessage {
  return {
    name: "Open",
    messageId,
    objectId: "object-1",
    extensionPoint: "document.customerorder.edit",
    displayMode: "expanded",
  };
}

function createHost(): OpenMessageBufferHost & { emitMessage: (data: unknown) => void } {
  let listener: ((event: { data: unknown }) => void) | null = null;

  return {
    __MOYSKLAD_WIDGET_OPEN_MESSAGE__: null,
    addEventListener: (_event, nextListener) => {
      listener = nextListener;
    },
    emitMessage: (data) => {
      listener?.({ data });
    },
  };
}

test("isWidgetOpenMessage распознает только Open", () => {
  assert.equal(isWidgetOpenMessage(makeOpenMessage()), true);
  assert.equal(isWidgetOpenMessage({ name: "Save" }), false);
  assert.equal(isWidgetOpenMessage(null), false);
});

test("buffer helper сохраняет и читает Open message", () => {
  const host = createHost();
  const message = makeOpenMessage(2);

  assert.equal(getBufferedOpenMessage(host), null);
  setBufferedOpenMessage(host, message);
  assert.deepEqual(getBufferedOpenMessage(host), message);
});

test("installOpenMessageBuffer сохраняет ранний Open до React mount", () => {
  const host = createHost();
  const message = makeOpenMessage(3);

  installOpenMessageBuffer(host);
  host.emitMessage(message);

  assert.deepEqual(getBufferedOpenMessage(host), message);
});

test("installOpenMessageBuffer игнорирует non-Open messages", () => {
  const host = createHost();

  installOpenMessageBuffer(host);
  host.emitMessage({ name: "Save", messageId: 1 });

  assert.equal(getBufferedOpenMessage(host), null);
});
