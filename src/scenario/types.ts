/**
 * Типы модуля «Действия в сценариях». Файл чистый: его импортируют и сервер, и браузерный код
 * (журнал в окне чатов), поэтому здесь только типы и представления для pageData.
 */

/** Действие из блока <scenario> дескриптора: name уходит в actionName запроса, title видит администратор. */
export type ScenarioAction = {
  name: string;
  title: string;
};

/** ok — ответили 200, rejected — 400 с сообщением пользователю, failed — 5xx, МойСклад повторит. */
export type ScenarioOutcome = "ok" | "rejected" | "failed";

/** Срабатывание действия, записанное обработчиком POST .../apps/{appId}/{accountId}/scenario. */
export type ScenarioEventView = {
  id: number | null;
  createdAt: string;
  actionName: string;
  actionTitle: string;
  /** ADD, MODIFY, CHANGE_STATUS, OVERDUE, CHANGE_PRODUCTION_STATE — событие сценария в МоемСкладе. */
  actionType: string;
  objectType: string;
  objectId: string;
  objectName: string;
  outcome: ScenarioOutcome;
  message: string;
};

/** Журнал в pageData окна чатов и в ответе POST /utils/scenario-events. */
export type ScenarioJournalData = {
  scenarioActions: ScenarioAction[];
  scenarioEvents: ScenarioEventView[];
};
