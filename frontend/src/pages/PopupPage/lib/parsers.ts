import { parseMaybeJson } from "../../../lib/widget-sdk";

export function parsePopupParams(input: string): Record<string, unknown> {
  const payload = parseMaybeJson(input);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}
