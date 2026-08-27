import WidgetSDK, { type WidgetSDKInstance } from "@moysklad/js-widget-sdk";

declare global {
  interface Window {
    widgetSdk?: WidgetSDKInstance;
    widgetLog?: (label: string, payload?: unknown) => void;
  }
}

/**
 * Один экземпляр JS Widget SDK на страницу. Создается при загрузке бандла,
 * до монтирования React, чтобы не пропустить первые сообщения от МоегоСклада.
 * Доступен как window.widgetSdk — удобно дергать методы из консоли браузера.
 */
export const sdk = WidgetSDK.create({ debug: true }) as WidgetSDKInstance & Record<string, any>;

window.widgetSdk = sdk;
