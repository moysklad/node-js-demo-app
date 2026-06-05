import { useCallback } from "react";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { useWidgetSdk } from "../../lib/use-widget-sdk";
import { PopupActionsPanel } from "./components/PopupActionsPanel";
import { PopupLogPanel } from "./components/PopupLogPanel";
import { usePopupActions } from "./hooks/use-popup-actions";
import { usePopupEvents } from "./hooks/use-popup-events";
import { usePopupLogs } from "./hooks/use-popup-logs";

export default function PopupPage() {
  const { sdk } = useWidgetSdk(true);
  const { showSnackbar } = useSnackbar();
  const { log, logs } = usePopupLogs();

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

  usePopupEvents(sdk, log);

  const { onClosePopup, onNavigate, onSelectFolder, onShowDialog, onShowPopup } = usePopupActions(
    sdk,
    log,
    showErrorSnackbar
  );

  return (
    <main className="shell shell--popup">
      <PopupActionsPanel
        onSelectFolder={onSelectFolder}
        onNavigate={onNavigate}
        onShowDialog={onShowDialog}
        onShowPopup={onShowPopup}
        onClosePopup={onClosePopup}
      />
      <PopupLogPanel logs={logs} />
    </main>
  );
}
