import { useEffect, useRef, useState } from "react";
import WidgetSDK from "@moysklad/js-widget-sdk";
import type { WidgetOpenMessage, WidgetSdk } from "./sdk";

export function useWidgetSdk(debug = true) {
  const sdkRef = useRef<WidgetSdk | null>(null);
  const [latestOpenMessage, setLatestOpenMessage] = useState<WidgetOpenMessage | null>(null);

  if (!sdkRef.current) {
    sdkRef.current = WidgetSDK.create({ debug }) as WidgetSdk;
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message && typeof message === "object" && message.name === "Open") {
        setLatestOpenMessage(message as WidgetOpenMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      sdkRef.current?.destroy?.();
      sdkRef.current = null;
    };
  }, []);

  return {
    sdk: sdkRef.current,
    latestOpenMessage,
  };
}
