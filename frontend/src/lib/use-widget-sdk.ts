import { useRef } from "react";
import WidgetSDK from "@moysklad/js-widget-sdk";

export function useWidgetSdk(debug = true) {
  const sdkRef = useRef<any>(null);

  if (!sdkRef.current) {
    sdkRef.current = WidgetSDK.create({ debug }) as any;
  }

  return sdkRef.current;
}
