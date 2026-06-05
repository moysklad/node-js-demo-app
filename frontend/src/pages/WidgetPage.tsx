import { useEffect, useRef, useState } from "react";
import { Text } from "@moysklad/uikit/components/Text";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { VStack } from "@moysklad/uikit/components/VStack";
import { useWidgetSdk } from "../lib/use-widget-sdk";
import {
  diffState,
  formatDiffs,
  normalizeDialogButtons,
  parseUpdatePayload,
  parseValidationFeedbackInput,
  type LogEntry,
  type WidgetChangeMessage,
  type WidgetContext,
  type WidgetOpenMessage,
  type WidgetOpenPopupMessage,
  type WidgetSaveMessage,
} from "../lib/sdk";
import { WidgetLogPanel } from "./widget/WidgetLogPanel";
import { WidgetMainPanel } from "./widget/WidgetMainPanel";

const AUTO_OPEN_FEEDBACK_DELAY_MS = 1000;

function resolveWidgetEntity(): WidgetContext["entity"] | null {
  if (window.location.pathname === "/entry/widget-customerorder") {
    return "customerorder";
  }

  if (window.location.pathname === "/entry/widget-invoiceout") {
    return "invoiceout";
  }

  return null;
}

export default function WidgetPage() {
  const [context, setContext] = useState<WidgetContext | null>(null);
  const [error, setError] = useState("");
  const [objectLabel, setObjectLabel] = useState("—");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const { sdk, latestOpenMessage } = useWidgetSdk(true);
  const { showSnackbar } = useSnackbar();
  const entity = resolveWidgetEntity();
  const objectStateRef = useRef<Record<string, unknown>>({});
  const lastAcknowledgedOpenMessageIdRef = useRef<number | null>(null);
  const openFeedbackTimerRef = useRef<number | null>(null);

  const log = (label: string, payload?: unknown) => {
    setLogs((prev) => [...prev, { label, payload }]);
  };

  const showErrorSnackbar = (message: string) => {
    showSnackbar({
      message,
      variant: "error",
      autoHideDuration: 5000,
    });
  };

  const fetchObjectLabel = async (activeContext: WidgetContext, objectId: string, signal?: AbortSignal) => {
    const response = await fetch(activeContext.getObjectUrl, {
      method: "POST",
      credentials: "same-origin",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contextNonce: activeContext.contextNonce,
        objectId,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return text;
  };

  const clearPendingOpenFeedbackTimer = () => {
    if (openFeedbackTimerRef.current === null) {
      return;
    }

    window.clearTimeout(openFeedbackTimerRef.current);
    openFeedbackTimerRef.current = null;
  };

  useEffect(() => {
    const stopAutoResize = sdk.autoResizeIframe();

    return () => {
      stopAutoResize();
    };
  }, [sdk]);

  useEffect(() => {
    if (!entity) {
      setContext(null);
      setError("Не удалось определить тип виджета");
      return;
    }

    let cancelled = false;

    setContext(null);
    setError("");

    fetch(`/utils/entry-context/widget?entity=${encodeURIComponent(entity)}`, { credentials: "same-origin" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || "Не удалось загрузить контекст виджета");
        }

        return payload as WidgetContext;
      })
      .then((payload) => {
        if (!cancelled) {
          setContext(payload);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          showErrorSnackbar(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entity]);

  useEffect(() => {
    log("SDK initialized", { debug: true });

    const offOpen = sdk.onOpen((message: WidgetOpenMessage) => {
      log("Event: Open", message);
    });
    const offOpenPopup = sdk.onOpenPopup((message: WidgetOpenPopupMessage) => log("Event: OpenPopup", message));
    const offChange = sdk.onChange((message: WidgetChangeMessage) => {
      log("Event: Change", message);

      if (!message.objectState) {
        log("Change ignored", { reason: "missing objectState" });
        return;
      }

      log("Event: Change (diff)", formatDiffs(diffState(objectStateRef.current, message.objectState)));
      objectStateRef.current = message.objectState;
    });
    const offSave = sdk.onSave((message: WidgetSaveMessage) => log("Event: Save", message));

    return () => {
      clearPendingOpenFeedbackTimer();
      offOpen();
      offOpenPopup();
      offChange();
      offSave();
    };
  }, [sdk]);

  useEffect(() => {
    const openMessageId = latestOpenMessage?.messageId;

    clearPendingOpenFeedbackTimer();

    if (openMessageId === undefined || openMessageId === lastAcknowledgedOpenMessageIdRef.current) {
      return;
    }

    openFeedbackTimerRef.current = window.setTimeout(() => {
      const result = sdk.openFeedback(openMessageId);

      if (result) {
        lastAcknowledgedOpenMessageIdRef.current = openMessageId;
      }

      log("auto openFeedback sent", result);
      openFeedbackTimerRef.current = null;
    }, AUTO_OPEN_FEEDBACK_DELAY_MS);

    return () => {
      clearPendingOpenFeedbackTimer();
    };
  }, [latestOpenMessage, sdk]);

  useEffect(() => {
    if (!latestOpenMessage) {
      setObjectLabel("—");
      return;
    }

    const openObjectId =
      latestOpenMessage && latestOpenMessage.objectId !== undefined ? String(latestOpenMessage.objectId) : null;

    if (!openObjectId) {
      setObjectLabel("—");
      log("object fetch skipped", { reason: "missing objectId" });
      return;
    }

    setObjectLabel("—");

    if (!context) {
      return;
    }

    const abortController = new AbortController();

    void fetchObjectLabel(context, openObjectId, abortController.signal)
      .then((text) => {
        setObjectLabel(text);
      })
      .catch((fetchError: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setObjectLabel("—");
        log("object fetch error", { message });
        showErrorSnackbar(message);
      });

    return () => {
      abortController.abort();
    };
  }, [context, latestOpenMessage]);

  const withLoggedSdkAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      log(`${label} response`, await action());
    } catch (eventError: unknown) {
      const message = eventError instanceof Error ? eventError.message : String(eventError);
      log(`${label} error`, {
        message,
        name: eventError instanceof Error ? eventError.name : "Error",
      });
      showErrorSnackbar(message);
    }
  };

  if (error) {
    return (
      <main className="shell shell--widget">
        <section className="card card--widget">
          <VStack size="s8">
            <Text.H4>Ошибка загрузки</Text.H4>
            <Text.Body>{error}</Text.Body>
          </VStack>
        </section>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="shell shell--widget">
        <Text.Body>Загрузка...</Text.Body>
      </main>
    );
  }

  return (
    <main className="shell shell--widget">
      <WidgetMainPanel
        context={context}
        objectLabel={objectLabel}
        onSelectFolder={() => withLoggedSdkAction("selectGoodFolder", () => sdk.selectGoodFolder())}
        onNavigate={(path) => withLoggedSdkAction("navigateTo", () => sdk.navigateTo(path, "blank"))}
        onShowDialog={(nextDialogText, nextDialogButtons) =>
          withLoggedSdkAction("showDialog", () => sdk.showDialog(nextDialogText, normalizeDialogButtons(nextDialogButtons)))
        }
        onSetDirty={() => log("setDirty sent", sdk.setDirty())}
        onClearDirty={() => log("clearDirty sent", sdk.clearDirty())}
        onValidationFeedback={(nextValidationPayload) => {
          const { valid, message, changeMessageId } = parseValidationFeedbackInput(nextValidationPayload);

          log("validationFeedback sent", sdk.validationFeedback(valid, message, changeMessageId));
        }}
        onUpdate={(nextUpdatePayload) => withLoggedSdkAction("update", () => sdk.update(parseUpdatePayload(nextUpdatePayload)))}
        onShowPopup={() => withLoggedSdkAction("showPopup", () => sdk.showPopup("some-popup", { foo: "bar" }))}
        onClosePopup={() => log("closePopup sent", sdk.closePopup({ ok: true }))}
      />
      <WidgetLogPanel logs={logs} />
    </main>
  );
}
