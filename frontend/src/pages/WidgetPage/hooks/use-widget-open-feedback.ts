import { useEffect, useRef } from "react";
import type { WidgetOpenMessage, WidgetSdk } from "../../../lib/widget-sdk";
import { resolveOpenFeedbackDecision } from "../lib/open-feedback";

type LogFn = (label: string, payload?: unknown) => void;
const OPEN_FEEDBACK_TIMEOUT_MS = 1000;

type Props = {
  isContextLoading: boolean;
  latestOpenMessage: WidgetOpenMessage | null;
  log: LogFn;
  sdk: WidgetSdk;
};

export function useWidgetOpenFeedback({ isContextLoading, latestOpenMessage, log, sdk }: Props) {
  const lastSentMessageIdRef = useRef<number | null>(null);
  const lastLoggedStateRef = useRef<string | null>(null);
  const timeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const decision = resolveOpenFeedbackDecision({
      isContextLoading,
      latestOpenMessage,
      lastSentMessageId: lastSentMessageIdRef.current,
    });

    if (decision.kind === "idle" || decision.kind === "skip") {
      return;
    }

    if (decision.kind === "wait") {
      if (timeoutIdRef.current === null) {
        timeoutIdRef.current = window.setTimeout(() => {
          const result = sdk.openFeedback(decision.messageId);
          const payload = {
            messageId: decision.messageId,
            result,
            isContextLoading: true,
            reason: "timeout",
          };

          log("openFeedback sent", payload);
          console.info("[Widget] openFeedback sent", payload);

          if (result) {
            lastSentMessageIdRef.current = decision.messageId;
          }

          timeoutIdRef.current = null;
        }, OPEN_FEEDBACK_TIMEOUT_MS);
      }

      const stateKey = `waiting:${decision.messageId}:${isContextLoading}`;

      if (lastLoggedStateRef.current !== stateKey) {
        const payload = {
          messageId: decision.messageId,
          isContextLoading,
          timeoutMs: OPEN_FEEDBACK_TIMEOUT_MS,
        };

        log("openFeedback waiting", payload);
        console.info("[Widget] openFeedback waiting", payload);
        lastLoggedStateRef.current = stateKey;
      }

      return;
    }

    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    const result = sdk.openFeedback(decision.messageId);
    const payload = {
      messageId: decision.messageId,
      result,
      isContextLoading,
    };

    log("openFeedback sent", payload);
    console.info("[Widget] openFeedback sent", payload);
    lastLoggedStateRef.current = `sent:${decision.messageId}:${String(result)}`;

    if (result) {
      lastSentMessageIdRef.current = decision.messageId;
    }
  }, [isContextLoading, latestOpenMessage, log, sdk]);
}
