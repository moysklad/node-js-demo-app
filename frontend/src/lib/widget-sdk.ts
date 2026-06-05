import type { ShowDialogButton, WidgetMessage, WidgetSDKInstance } from "@moysklad/js-widget-sdk";

export type LogEntry = {
  label: string;
  payload?: unknown;
};

export type WidgetOpenMessage = WidgetMessage & {
  name: "Open";
  messageId?: number;
  objectId?: string;
  extensionPoint?: string;
  displayMode?: string;
};

export type WidgetOpenPopupMessage = WidgetMessage & {
  name: "OpenPopup";
  messageId?: number;
};

export type WidgetChangeMessage = WidgetMessage & {
  name: "Change";
  messageId?: number;
  objectState?: Record<string, unknown>;
};

export type WidgetSaveMessage = WidgetMessage & {
  name: "Save";
  messageId?: number;
};

export type WidgetSdk = Omit<WidgetSDKInstance, "onOpen" | "onOpenPopup" | "onChange" | "onSave"> & {
  onOpen(callback: (message: WidgetOpenMessage) => void): () => void;
  onOpenPopup(callback: (message: WidgetOpenPopupMessage) => void): () => void;
  onChange(callback: (message: WidgetChangeMessage) => void): () => void;
  onSave(callback: (message: WidgetSaveMessage) => void): () => void;
};

export function formatPayload(payload: unknown): string {
  if (payload === undefined) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function parseMaybeJson(input: string): unknown {
  const value = input.trim();

  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function normalizeDialogButtons(input: string): ShowDialogButton[] | undefined {
  const payload = parseMaybeJson(input);
  const rawButtons = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { buttons?: unknown }).buttons)
      ? (payload as { buttons: unknown[] }).buttons
      : undefined;

  if (!rawButtons) {
    return undefined;
  }

  return rawButtons.flatMap((button) => {
    if (!button || typeof button !== "object") {
      return [];
    }

    const name = (button as { name?: unknown }).name;
    const caption = (button as { caption?: unknown }).caption;

    if (typeof name !== "string" || typeof caption !== "string") {
      return [];
    }

    return [{ name, caption }];
  });
}
