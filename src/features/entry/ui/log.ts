import { useCallback, useEffect, useState } from "react";

export type LogEntry = {
  ts: string;
  label: string;
  payload?: unknown;
};

export function formatLogEntry(entry: LogEntry): string {
  const data = entry.payload === undefined ? "" : JSON.stringify(entry.payload, null, 2);
  return `[${entry.ts}] ${entry.label}\n${data}`;
}

/**
 * Панель логов: новые записи сверху. Функция log также публикуется как window.widgetLog,
 * чтобы из консоли браузера можно было писать в ту же панель.
 */
export function useLog(): { entries: LogEntry[]; log: (label: string, payload?: unknown) => void } {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const log = useCallback((label: string, payload?: unknown) => {
    const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
    setEntries((current) => [{ ts, label, payload }, ...current]);
  }, []);

  useEffect(() => {
    window.widgetLog = log;
  }, [log]);

  return { entries, log };
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

export function describeError(error: unknown): { message: string; name: string } {
  return {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Error"
  };
}
