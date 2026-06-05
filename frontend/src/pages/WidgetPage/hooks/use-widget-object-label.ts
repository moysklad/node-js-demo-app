import { useEffect, useState } from "react";
import type { WidgetOpenMessage } from "../../../lib/widget-sdk";
import type { WidgetContext } from "../types";

type LogFn = (label: string, payload?: unknown) => void;

const fetchObjectLabel = async (getObjectUrl: string, contextNonce: string, objectId: string, signal?: AbortSignal) => {
  const response = await fetch(getObjectUrl, {
    method: "POST",
    credentials: "same-origin",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contextNonce,
      objectId,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return text;
};

export const useWidgetObjectLabel = (
  context: WidgetContext | null,
  latestOpenMessage: WidgetOpenMessage | null,
  log: LogFn
) => {
  const [objectLabel, setObjectLabel] = useState("—");
  const [isObjectLabelLoading, setIsObjectLabelLoading] = useState(false);

  useEffect(() => {
    if (!latestOpenMessage) {
      setObjectLabel("—");
      setIsObjectLabelLoading(false);
      return;
    }

    const openObjectId = latestOpenMessage.objectId !== undefined ? String(latestOpenMessage.objectId) : null;

    if (!openObjectId) {
      setObjectLabel("—");
      setIsObjectLabelLoading(false);
      log("object label skipped", { reason: "missing objectId" });
      return;
    }

    setObjectLabel(openObjectId);

    if (!context) {
      setIsObjectLabelLoading(false);
      return;
    }

    const abortController = new AbortController();
    setIsObjectLabelLoading(true);

    void fetchObjectLabel(context.getObjectUrl, context.contextNonce, openObjectId, abortController.signal)
      .then((text) => {
        setObjectLabel(text);
        setIsObjectLabelLoading(false);
        log("object label enriched", { objectId: openObjectId });
      })
      .catch((fetchError: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setObjectLabel(openObjectId);
        setIsObjectLabelLoading(false);
        log("object label enrichment failed", { message, objectId: openObjectId });
      });

    return () => {
      abortController.abort();
    };
  }, [context, latestOpenMessage, log]);

  return {
    objectLabel,
    isObjectLabelLoading,
  };
};
