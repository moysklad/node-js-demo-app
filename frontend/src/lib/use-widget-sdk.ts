import { useEffect, useRef, useState } from "react";
import WidgetSDK from "@moysklad/js-widget-sdk";
import type { WidgetOpenMessage, WidgetSdk } from "./widget-sdk";
import { getBufferedOpenMessage, setBufferedOpenMessage } from "./open-message-buffer";

export const useWidgetSdk = (debug = true) => {
  const [latestOpenMessage, setLatestOpenMessage] = useState<WidgetOpenMessage | null>(() =>
    getBufferedOpenMessage(window)
  );

  const sdkRef = useRef<WidgetSdk | null>(null);

  if (!sdkRef.current) {
    sdkRef.current = WidgetSDK.create({ debug }) as WidgetSdk;
  }

  useEffect(() => {
    const sdk = sdkRef.current;

    if (!sdk) {
      return;
    }

    setLatestOpenMessage(getBufferedOpenMessage(window));

    const offOpen = sdk.onOpen((message: WidgetOpenMessage) => {
      setBufferedOpenMessage(window, message);
      setLatestOpenMessage(message);
    });

    return () => {
      offOpen();
      sdkRef.current?.destroy?.();
      sdkRef.current = null;
    };
  }, []);

  return {
    sdk: sdkRef.current,
    latestOpenMessage,
  };
};
