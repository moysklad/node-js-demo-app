import { useEffect, useState } from "react";
import type { IframeContext } from "../types";

const loadIframeContext = async (): Promise<IframeContext> => {
  const response = await fetch("/utils/entry-context/iframe", { credentials: "same-origin" });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "Не удалось загрузить контекст iframe");
  }

  return payload as IframeContext;
};

export const useIframeContext = () => {
  const [data, setData] = useState<IframeContext | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void loadIframeContext()
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    data,
    error,
    setData,
  };
};
