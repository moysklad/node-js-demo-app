import type { WidgetOpenMessage } from "./widget-sdk";

export const OPEN_MESSAGE_BUFFER_KEY = "__MOYSKLAD_WIDGET_OPEN_MESSAGE__";

export type OpenMessageBufferHost = {
  addEventListener: (event: "message", listener: (event: { data: unknown }) => void) => void;
  [OPEN_MESSAGE_BUFFER_KEY]?: WidgetOpenMessage | null;
};

declare global {
  interface Window {
    __MOYSKLAD_WIDGET_OPEN_MESSAGE__?: WidgetOpenMessage | null;
  }
}

export function isWidgetOpenMessage(value: unknown): value is WidgetOpenMessage {
  return Boolean(value) && typeof value === "object" && (value as { name?: unknown }).name === "Open";
}

export function getBufferedOpenMessage(
  host: Pick<OpenMessageBufferHost, typeof OPEN_MESSAGE_BUFFER_KEY>
): WidgetOpenMessage | null {
  return host[OPEN_MESSAGE_BUFFER_KEY] ?? null;
}

export function setBufferedOpenMessage(
  host: Pick<OpenMessageBufferHost, typeof OPEN_MESSAGE_BUFFER_KEY>,
  message: WidgetOpenMessage | null
) {
  host[OPEN_MESSAGE_BUFFER_KEY] = message;
}

export function installOpenMessageBuffer(host: OpenMessageBufferHost) {
  setBufferedOpenMessage(host, getBufferedOpenMessage(host));

  host.addEventListener("message", (event) => {
    if (isWidgetOpenMessage(event.data)) {
      setBufferedOpenMessage(host, event.data);
    }
  });
}
