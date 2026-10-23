import { config } from "../lib/config/config";
import { AppInstance } from "../lib/domain/app-instance";
import { jsonApi, jsonApiEntity } from "../lib/integrations/json-api";
import { logMessage } from "../lib/observability/logger";
import { describeScenarioActions, describeScenarioEvent, SCENARIO_ACTIONS, ScenarioEvent } from "./domain/scenario-event";
import type { ScenarioJournalData } from "./types";

// Код ошибки произвольный: МойСклад показывает пользователю errorMessage, code нужен только для своих логов.
const REJECT_ERROR_CODE = 1001;

export type ScenarioActionResponse = {
  status: number;
  body: { error: { errorMessage: string; code?: number } } | null;
};

/**
 * Обрабатывает действие из сценария по правилам Vendor API: 200 — действие выполнено, 400 с объектом
 * error — отказ по вине пользователя (сообщение попадет в историю сценария), 5xx — МойСклад повторит
 * запрос. Ответить нужно быстрее 10 секунд, иначе МойСклад считает попытку неуспешной и тоже повторяет.
 */
export async function handleScenarioAction(appId: string, accountId: string, body: unknown): Promise<ScenarioActionResponse> {
  const request = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const actionName = requestString(request.actionName);
  const actionType = requestString(request.actionType);
  const objectId = requestString(request.objectId);
  const objectType = requestString(request.objectType);

  if (!actionName || !actionType || !objectId || !objectType) {
    return errorResponse("В запросе нет actionName, actionType, objectId или objectType");
  }

  if (!(actionName in SCENARIO_ACTIONS)) {
    logMessage("WARN", `Unknown scenario action ${actionName} for appId=${appId} on accountId=${accountId}`);
    return errorResponse(`Решение не поддерживает действие «${actionName}»`);
  }

  const event = new ScenarioEvent(appId, accountId, actionName, actionType, objectType, objectId);

  if (actionName === "reject") {
    event.outcome = "rejected";
    event.message = `Решение отклонило действие для объекта ${objectType} ${objectId}`;
    saveEvent(event);
    return errorResponse(event.message, REJECT_ERROR_CODE);
  }

  if (actionName === "fetch-object") {
    const app = AppInstance.load(appId, accountId);
    const result = await jsonApi(app.accessToken).getScenarioObject(jsonApiEntity(objectType), objectId);
    const object = result.data;

    if (!object?.name) {
      event.outcome = "failed";
      const status = result.failure?.kind === "http" ? result.failure.status : null;
      if (status !== null && status >= 400 && status < 500 && status !== 429) {
        event.message = `JSON API не отдал объект ${objectType} ${objectId}: статус ${status}, повтор не поможет`;
        saveEvent(event);
        return errorResponse(event.message);
      }
      event.message = "Не удалось получить объект через JSON API, МойСклад повторит действие";
      saveEvent(event);
      return { status: 502, body: null };
    }

    event.objectName = object.name;
    event.message = `Получен объект ${objectType} «${event.objectName}»`;
    saveEvent(event);
    return { status: 200, body: null };
  }

  event.message = `Событие ${actionType} для объекта ${objectType} ${objectId} записано`;
  saveEvent(event);
  return { status: 200, body: null };
}

/** Журнал событий и список действий из дескриптора для окна чатов. */
export function scenarioJournal(accountId: string): ScenarioJournalData {
  return {
    scenarioActions: describeScenarioActions(),
    scenarioEvents: ScenarioEvent.listRecent(config.appId, accountId).map(describeScenarioEvent)
  };
}

function saveEvent(event: ScenarioEvent): void {
  event.persist();
  logMessage(
    "INFO",
    `Scenario action ${event.actionName} (${event.actionType}) for ${event.objectType} ${event.objectId} on accountId=${event.accountId}: ${event.outcome}`
  );
}

function errorResponse(errorMessage: string, code?: number): ScenarioActionResponse {
  return { status: 400, body: { error: code === undefined ? { errorMessage } : { errorMessage, code } } };
}

function requestString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
