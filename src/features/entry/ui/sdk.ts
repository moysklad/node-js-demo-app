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

export type SdkEventName = "Open" | "OpenPopup" | "Change" | "Save";
export type SdkEvent = { name: SdkEventName; message: any };

const bufferedEvents: SdkEvent[] = [];
const subscribers = new Set<(event: SdkEvent) => void>();

// Слушатели вешаются здесь, при загрузке модуля, а не в React: SDK не переигрывает события
// поздним слушателям, а Open от МоегоСклада может прийти раньше, чем смонтируется страница.
// Без обработки Open виджет не отправит openFeedback, и хост будет считать его не загрузившимся.
for (const name of ["Open", "OpenPopup", "Change", "Save"] as const) {
  sdk.on(name, (message: unknown) => {
    const event: SdkEvent = { name, message };
    bufferedEvents.push(event);
    subscribers.forEach((subscriber) => subscriber(event));
  });
}

/** Подписка на события SDK с доигрыванием того, что пришло до подписки. Возвращает отписку. */
export function subscribeSdkEvents(subscriber: (event: SdkEvent) => void): () => void {
  bufferedEvents.forEach(subscriber);
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
