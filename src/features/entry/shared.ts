export function logToPanel(logEl: HTMLElement | null, label: string, payload?: unknown): void {
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  const data = payload ? JSON.stringify(payload, null, 2) : "";
  const message = `[${ts}] ${label}\n${data}\n\n`;

  if (logEl) {
    logEl.textContent = message + logEl.textContent;
  } else {
    console.log(message);
  }
}

export function parseMaybeJson(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
