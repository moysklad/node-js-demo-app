import { useEffect } from "react";
import type { WidgetOpenMessage, WidgetOpenPopupMessage, WidgetSdk } from "../../../lib/widget-sdk";

type LogFn = (label: string, payload?: unknown) => void;

export const usePopupEvents = (sdk: WidgetSdk, log: LogFn) => {
  useEffect(() => {
    log("SDK initialized", { debug: true });

    const offOpen = sdk.onOpen((message: WidgetOpenMessage) => log("Event: Open", message));
    const offOpenPopup = sdk.onOpenPopup((message: WidgetOpenPopupMessage) => log("Event: OpenPopup", message));

    return () => {
      offOpen();
      offOpenPopup();
    };
  }, [sdk, log]);
};
