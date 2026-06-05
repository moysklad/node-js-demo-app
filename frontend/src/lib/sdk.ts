import type { ShowDialogButton, WidgetMessage, WidgetSDKInstance } from "@moysklad/js-widget-sdk";

export type LogEntry = {
  label: string;
  payload?: unknown;
};

export type IframeContext = {
  accountId: string;
  appVersion: string;
  contextNonce: string;
  fio: string;
  infoMessage: string;
  isAdmin: boolean;
  isSettingsRequired: boolean;
  store: string;
  storesValues: string[];
  uid: string;
};

export type UpdateSettingsResponse = {
  message: string;
  status: {
    className: string;
    title: string;
    showDetails: boolean;
    infoMessage: string;
    store: string;
  };
};

export type WidgetContext = {
  contextNonce: string;
  entity: "customerorder" | "invoiceout";
  fio: string;
  getObjectUrl: string;
  uid: string;
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

export type ParsedValidationFeedback = {
  valid: boolean;
  message?: string;
  changeMessageId?: number;
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

export function parseValidationFeedbackInput(input: string): ParsedValidationFeedback {
  const payload = parseMaybeJson(input);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return typeof payload === "string" ? { valid: false, message: payload } : { valid: false };
  }

  const validValue = (payload as { valid?: unknown }).valid;
  const messageValue = (payload as { message?: unknown }).message;
  const correlationIdValue =
    (payload as { correlationId?: unknown }).correlationId ??
    (payload as { changeMessageId?: unknown }).changeMessageId;

  return {
    valid: validValue !== undefined ? Boolean(validValue) : false,
    message: messageValue !== undefined ? String(messageValue) : undefined,
    changeMessageId: typeof correlationIdValue === "number" ? correlationIdValue : undefined,
  };
}

export function parseUpdatePayload(input: string): Record<string, unknown> {
  const payload = parseMaybeJson(input);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}

export function parsePopupParams(input: string): Record<string, unknown> {
  const payload = parseMaybeJson(input);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (left && right && typeof left === "object" && typeof right === "object") {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  return false;
}

export function diffState(oldState: Record<string, unknown>, newState: Record<string, unknown>): Map<string, unknown> {
  const result = new Map<string, unknown>();

  for (const key in newState) {
    const hasOldValue = Object.prototype.hasOwnProperty.call(oldState, key);
    const oldValue = hasOldValue ? oldState[key] : undefined;

    if (!hasOldValue || !valuesEqual(newState[key], oldValue)) {
      result.set(key, newState[key]);
    }
  }

  for (const key in oldState) {
    if (!Object.prototype.hasOwnProperty.call(newState, key)) {
      result.set(key, "<deleted>");
    }
  }

  return result;
}

export function formatDiffs(map: Map<string, unknown>): string {
  if (map.size === 0) {
    return "objectState: no changes";
  }

  const lines: string[] = [];

  map.forEach((value, key) => {
    lines.push(value && typeof value === "object" ? `${key} = {...}` : `${key} = ${String(value)}`);
  });

  return `objectState changes:\n${lines.join("\n")}`;
}
