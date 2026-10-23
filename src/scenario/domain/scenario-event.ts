import type { ScenarioAction, ScenarioEventView, ScenarioOutcome } from "../types";

// Действия, которые решение объявляет в блоке <scenario> дескриптора. name уходит в actionName
// запроса МоегоСклада, title видит администратор на странице настройки сценария.
export const SCENARIO_ACTIONS: Record<string, string> = {
  "log-event": "Записать событие в журнал решения",
  "fetch-object": "Запросить объект через JSON API",
  reject: "Отклонить с сообщением пользователю"
};

// Сколько последних событий хранится на аккаунт: журнал в окне чатов показывает их целиком.
export const SCENARIO_EVENTS_LIMIT = 50;

export type ScenarioEventData = {
  id: number | null;
  appId: string;
  accountId: string;
  actionName: string;
  actionType: string;
  objectType: string;
  objectId: string;
  objectName: string;
  outcome: ScenarioOutcome;
  message: string;
  createdAt: string;
};

export interface ScenarioEventRepository {
  /** Пишет событие и оставляет на аккаунте только последние SCENARIO_EVENTS_LIMIT записей. */
  save(event: ScenarioEventData): ScenarioEventData;
  /** Новые события первыми. */
  listRecent(appId: string, accountId: string, limit?: number): ScenarioEventData[];
}

/** Одно срабатывание действия сценария: что пришло от МоегоСклада и чем ответило решение. */
export class ScenarioEvent {
  private static repository: ScenarioEventRepository | null = null;

  id: number | null = null;
  objectName = "";
  outcome: ScenarioOutcome = "ok";
  message = "";
  createdAt = "";

  constructor(
    readonly appId: string,
    readonly accountId: string,
    readonly actionName: string,
    readonly actionType: string,
    readonly objectType: string,
    readonly objectId: string
  ) {}

  static configureRepository(repository: ScenarioEventRepository): void {
    ScenarioEvent.repository = repository;
  }

  static listRecent(appId: string, accountId: string): ScenarioEvent[] {
    return ScenarioEvent.getRepository().listRecent(appId, accountId).map(ScenarioEvent.fromData);
  }

  persist(): void {
    const saved = ScenarioEvent.getRepository().save(this.toData());
    this.id = saved.id;
    this.createdAt = saved.createdAt;
  }

  private toData(): ScenarioEventData {
    return {
      id: this.id,
      appId: this.appId,
      accountId: this.accountId,
      actionName: this.actionName,
      actionType: this.actionType,
      objectType: this.objectType,
      objectId: this.objectId,
      objectName: this.objectName,
      outcome: this.outcome,
      message: this.message,
      createdAt: this.createdAt
    };
  }

  private static fromData(data: ScenarioEventData): ScenarioEvent {
    const event = new ScenarioEvent(data.appId, data.accountId, data.actionName, data.actionType, data.objectType, data.objectId);
    event.id = data.id;
    event.objectName = data.objectName;
    event.outcome = data.outcome;
    event.message = data.message;
    event.createdAt = data.createdAt;
    return event;
  }

  private static getRepository(): ScenarioEventRepository {
    if (!ScenarioEvent.repository) {
      throw new Error("Scenario event repository is not configured");
    }
    return ScenarioEvent.repository;
  }
}

export function describeScenarioActions(): ScenarioAction[] {
  return Object.entries(SCENARIO_ACTIONS).map(([name, title]) => ({ name, title }));
}

export function describeScenarioEvent(event: ScenarioEvent): ScenarioEventView {
  return {
    id: event.id,
    createdAt: event.createdAt,
    actionName: event.actionName,
    actionTitle: SCENARIO_ACTIONS[event.actionName] ?? event.actionName,
    actionType: event.actionType,
    objectType: event.objectType,
    objectId: event.objectId,
    objectName: event.objectName,
    outcome: event.outcome,
    message: event.message
  };
}
