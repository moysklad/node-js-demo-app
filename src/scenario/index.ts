import { Router, type Express, type Request, type Response } from "express";
import { config } from "../lib/config/config";
import { sendUnauthorized } from "../lib/http/http-responses";
import { resolveBackendContextFromSession } from "../lib/session/user-context";
import { ScenarioEvent } from "./domain/scenario-event";
import { SqliteScenarioEventRepository } from "./domain/scenario-event-sqlite-repository";
import { scenarioJournal } from "./service";
import type { ScenarioJournalData } from "./types";

/**
 * Подключение модуля «Действия в сценариях» к решению.
 * Общему коду нужен один вызов registerScenario(app); остальные места подключения
 * перечислены в src/scenario/README.md и помечены меткой [feature:scenario].
 */
export function registerScenario(app: Express): void {
  ScenarioEvent.configureRepository(new SqliteScenarioEventRepository(config.appDbPath));
  // Журнал для окна чатов: запрос из браузера авторизуется contextNonce, как и остальные /utils.
  app.use("/utils", createScenarioEventsRouter());
}

export function createScenarioEventsRouter(): Router {
  const router = Router();

  router.post("/scenario-events", (req: Request, res: Response) => {
    const authContext = resolveBackendContextFromSession(req);

    if (!authContext) {
      sendUnauthorized(res, "Ошибка авторизации: откройте окно заново.");
      return;
    }

    res.json(scenarioJournal(authContext.accountId));
  });

  return router;
}

/** Данные журнала для окна чатов (src/entry/router.ts, page: "chat"). */
export function scenarioChatLocals(accountId: string): ScenarioJournalData {
  return scenarioJournal(accountId);
}

export { handleScenarioAction } from "./service";
