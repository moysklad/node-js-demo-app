/** Данные страницы виджета: см. src/entry/router.ts (renderWidget) и client/main.tsx. Только типы. */
export type WidgetPageData = {
  uid: string;
  fio: string;
  contextNonce: string;
  /** POST-эндпоинт бэкенда, который по objectId из сообщения Open возвращает открытую сущность через JSON API. */
  getObjectUrl: string;
};
