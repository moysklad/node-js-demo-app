import type { AppStatusView } from "../../features/entry/iframe/page-data";
import { type AppInstance, AppStatus } from "./app-instance";

/** Состояние решения для карточки статуса в iframe: рендер страницы и ответ POST /utils/update-settings. */
export function describeAppStatus(app: AppInstance): AppStatusView {
  const isSettingsRequired = app.status !== AppStatus.ACTIVATED;

  return {
    className: isSettingsRequired ? "status-required" : "status-ready",
    title: isSettingsRequired ? "ТРЕБУЕТСЯ НАСТРОЙКА" : "РЕШЕНИЕ ГОТОВО К РАБОТЕ",
    showDetails: !isSettingsRequired,
    infoMessage: app.infoMessage,
    store: app.store
  };
}
