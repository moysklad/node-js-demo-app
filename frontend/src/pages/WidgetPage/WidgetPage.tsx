import { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "@moysklad/uikit/components/Text";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { VStack } from "@moysklad/uikit/components/VStack";
import { useWidgetSdk } from "../../lib/use-widget-sdk";
import { normalizeDialogButtons, type LogEntry } from "../../lib/widget-sdk";
import { WidgetLogPanel } from "./components/WidgetLogPanel";
import { WidgetMainPanel } from "./components/WidgetMainPanel";
import { useWidgetContext } from "./hooks/use-widget-context";
import { useWidgetEvents } from "./hooks/use-widget-events";
import { useWidgetObjectLabel } from "./hooks/use-widget-object-label";
import { useWidgetOpenFeedback } from "./hooks/use-widget-open-feedback";
import { parseUpdatePayload, parseValidationFeedbackInput } from "./lib/protocol";
import { resolveWidgetEntity } from "./lib/resolve-widget-entity";

export const WidgetPage = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const { sdk, latestOpenMessage } = useWidgetSdk(true);
  const { showSnackbar } = useSnackbar();
  const entity = resolveWidgetEntity(window.location.pathname);
  const objectStateRef = useRef<Record<string, unknown>>({});
  const { context, contextError, isContextLoading } = useWidgetContext(entity);

  const log = useCallback((label: string, payload?: unknown) => {
    setLogs((prev) => [...prev, { label, payload }]);
  }, []);

  const showErrorSnackbar = useCallback(
    (message: string) => {
      showSnackbar({
        message,
        variant: "error",
        autoHideDuration: 5000,
      });
    },
    [showSnackbar]
  );

  useEffect(() => {
    const stopAutoResize = sdk.autoResizeIframe();

    return () => {
      stopAutoResize();
    };
  }, [sdk]);

  useEffect(() => {
    if (contextError && entity) {
      showErrorSnackbar(contextError);
    }
  }, [contextError, entity, showErrorSnackbar]);

  useWidgetEvents(sdk, objectStateRef, log);

  const { objectLabel } = useWidgetObjectLabel(context, latestOpenMessage, log);

  useWidgetOpenFeedback({
    isContextLoading,
    latestOpenMessage,
    log,
    sdk,
  });

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

  if (!entity) {
    return (
      <main className="shell shell--widget">
        <section className="card card--widget">
          <VStack size="s8">
            <Text.H4>Ошибка загрузки</Text.H4>
            <Text.Body>{contextError}</Text.Body>
          </VStack>
        </section>
      </main>
    );
  }

  return (
    <main className="shell shell--widget">
      <WidgetMainPanel
        context={context}
        contextError={contextError}
        objectLabel={objectLabel}
        onSelectFolder={() => withLoggedSdkAction("selectGoodFolder", () => sdk.selectGoodFolder())}
        onNavigate={(path) => withLoggedSdkAction("navigateTo", () => sdk.navigateTo(path, "blank"))}
        onShowDialog={(nextDialogText, nextDialogButtons) =>
          withLoggedSdkAction("showDialog", () =>
            sdk.showDialog(nextDialogText, normalizeDialogButtons(nextDialogButtons))
          )
        }
        onSetDirty={() => log("setDirty sent", sdk.setDirty())}
        onClearDirty={() => log("clearDirty sent", sdk.clearDirty())}
        onValidationFeedback={(nextValidationPayload) => {
          const { valid, message, changeMessageId } = parseValidationFeedbackInput(nextValidationPayload);

          log("validationFeedback sent", sdk.validationFeedback(valid, message, changeMessageId));
        }}
        onUpdate={(nextUpdatePayload) =>
          withLoggedSdkAction("update", () => sdk.update(parseUpdatePayload(nextUpdatePayload)))
        }
        onShowPopup={() => withLoggedSdkAction("showPopup", () => sdk.showPopup("some-popup", { foo: "bar" }))}
        onClosePopup={() => log("closePopup sent", sdk.closePopup({ ok: true }))}
      />
      <WidgetLogPanel logs={logs} />
    </main>
  );
};
