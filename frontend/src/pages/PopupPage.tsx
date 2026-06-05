import { useEffect, useState } from "react";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { useWidgetSdk } from "../lib/use-widget-sdk";
import {
  normalizeDialogButtons,
  parsePopupParams,
  type LogEntry,
  type WidgetOpenMessage,
  type WidgetOpenPopupMessage,
} from "../lib/sdk";
import { PopupActionsPanel } from "./popup/PopupActionsPanel";
import { PopupLogPanel } from "./popup/PopupLogPanel";

export default function PopupPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { sdk } = useWidgetSdk(true);
  const { showSnackbar } = useSnackbar();

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

  useEffect(() => {
    log("SDK initialized", { debug: true });

    const offOpen = sdk.onOpen((message: WidgetOpenMessage) => log("Event: Open", message));
    const offOpenPopup = sdk.onOpenPopup((message: WidgetOpenPopupMessage) => log("Event: OpenPopup", message));

    return () => {
      offOpen();
      offOpenPopup();
    };
  }, [sdk]);

  const withLoggedSdkAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      log(`${label} response`, await action());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`${label} error`, {
        message,
        name: error instanceof Error ? error.name : "Error",
      });
      showErrorSnackbar(message);
    }
  };

  return (
    <main className="shell shell--popup">
      <PopupActionsPanel
        onSelectFolder={() => withLoggedSdkAction("selectGoodFolder", () => sdk.selectGoodFolder())}
        onNavigate={(path) => withLoggedSdkAction("navigateTo", () => sdk.navigateTo(path, "blank"))}
        onShowDialog={(dialogText, dialogButtons) =>
          withLoggedSdkAction("showDialog", () => sdk.showDialog(dialogText, normalizeDialogButtons(dialogButtons)))
        }
        onShowPopup={(popupName, popupParams) =>
          withLoggedSdkAction("showPopup", () => sdk.showPopup(popupName, parsePopupParams(popupParams)))
        }
        onClosePopup={() => log("closePopup sent", sdk.closePopup({ ok: true }))}
      />
      <PopupLogPanel logs={logs} />
    </main>
  );
}
