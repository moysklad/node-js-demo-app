import { useCallback, useState } from "react";
import type { LogEntry } from "../../../lib/widget-sdk";

export function usePopupLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const log = useCallback((label: string, payload?: unknown) => {
    setLogs((prev) => [...prev, { label, payload }]);
  }, []);

  return {
    log,
    logs,
  };
}
