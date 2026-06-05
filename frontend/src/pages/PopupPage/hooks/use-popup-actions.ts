import { useCallback } from "react";
import { normalizeDialogButtons, type WidgetSdk } from "../../../lib/widget-sdk";
import { parsePopupParams } from "../lib/parsers";

type LogFn = (label: string, payload?: unknown) => void;
type ShowErrorFn = (message: string) => void;

export function usePopupActions(sdk: WidgetSdk, log: LogFn, showErrorSnackbar: ShowErrorFn) {
  const withLoggedSdkAction = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
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
    },
    [log, showErrorSnackbar]
  );

  return {
    onClosePopup: () => log("closePopup sent", sdk.closePopup({ ok: true })),
    onNavigate: (path: string) => withLoggedSdkAction("navigateTo", () => sdk.navigateTo(path, "blank")),
    onSelectFolder: () => withLoggedSdkAction("selectGoodFolder", () => sdk.selectGoodFolder()),
    onShowDialog: (dialogText: string, dialogButtons: string) =>
      withLoggedSdkAction("showDialog", () => sdk.showDialog(dialogText, normalizeDialogButtons(dialogButtons))),
    onShowPopup: (popupName: string, popupParams: string) =>
      withLoggedSdkAction("showPopup", () => sdk.showPopup(popupName, parsePopupParams(popupParams))),
  };
}
