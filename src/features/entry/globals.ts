import type { WidgetSDKInstance } from "@moysklad/js-widget-sdk";

export {};

declare global {
  interface Window {
    widgetLog?: (label: string, payload?: unknown) => void;
    widgetSdk?: WidgetSDKInstance;
  }
}
