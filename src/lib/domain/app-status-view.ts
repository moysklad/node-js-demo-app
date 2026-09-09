import type { AppStatusView } from "../../features/entry/iframe/page-data";
import { type AppInstance, AppStatus } from "./app-instance";

/** Состояние решения для карточки статуса в iframe: рендер страницы и ответ POST /utils/update-settings. */
export function describeAppStatus(app: AppInstance): AppStatusView {
  const isSettingsRequired = app.status !== AppStatus.ACTIVATED;

  return {
    badge: isSettingsRequired ? "orange" : "green",
    title: isSettingsRequired ? "Требуется настройка" : "Решение готово к работе",
    showDetails: !isSettingsRequired,
    infoMessage: app.infoMessage,
    store: app.store
  };
}
