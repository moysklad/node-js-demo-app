import { useEffect, useState } from "react";
import type { WidgetContext } from "../types";

export const useWidgetContext = (entity: WidgetContext["entity"] | null) => {
  const [context, setContext] = useState<WidgetContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [isContextLoading, setIsContextLoading] = useState(false);

  useEffect(() => {
    if (!entity) {
      setContext(null);
      setContextError("Не удалось определить тип виджета");
      setIsContextLoading(false);
      return;
    }

    const abortController = new AbortController();

    setContext(null);
    setContextError("");
    setIsContextLoading(true);

    void fetch(`/utils/entry-context/widget?entity=${encodeURIComponent(entity)}`, {
      credentials: "same-origin",
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || "Не удалось загрузить контекст виджета");
        }

        return payload as WidgetContext;
      })
      .then((payload) => {
        setContext(payload);
        setIsContextLoading(false);
      })
      .catch((err: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        setContextError(message);
        setIsContextLoading(false);
      });

    return () => {
      abortController.abort();
    };
  }, [entity]);

  return {
    context,
    contextError,
    isContextLoading,
  };
};
