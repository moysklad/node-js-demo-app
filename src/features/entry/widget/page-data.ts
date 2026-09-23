/** Данные страницы виджета: см. src/entry/router.ts (renderWidget) и client/main.tsx. Только типы. */
export type WidgetPageData = {
  /** POST-эндпоинт бэкенда, который по objectId из сообщения Open возвращает открытую сущность через JSON API. */
  getObjectUrl: string;
};

/** Ответ POST /entry/user-context для виджета: контекст пользователя и contextNonce для backend-запросов. */
export type WidgetUserContext = {
  user: {
    accountId: string;
    userId: string;
    userUid: string;
    role: string;
    isAdmin: boolean;
  };
  contextNonce: string;
};
