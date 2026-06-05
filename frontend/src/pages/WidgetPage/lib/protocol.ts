import { parseMaybeJson } from "../../../lib/widget-sdk";
import type { ParsedValidationFeedback } from "../types";

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
