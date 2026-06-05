import { useEffect, type MutableRefObject } from "react";
import {
  type WidgetChangeMessage,
  type WidgetOpenMessage,
  type WidgetOpenPopupMessage,
  type WidgetSaveMessage,
  type WidgetSdk,
} from "../../../lib/widget-sdk";
import { diffState, formatDiffs } from "../lib/protocol";

type LogFn = (label: string, payload?: unknown) => void;

export function useWidgetEvents(sdk: WidgetSdk, objectStateRef: MutableRefObject<Record<string, unknown>>, log: LogFn) {
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
      offOpen();
      offOpenPopup();
      offChange();
      offSave();
    };
  }, [sdk, objectStateRef, log]);
}
