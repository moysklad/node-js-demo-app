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
