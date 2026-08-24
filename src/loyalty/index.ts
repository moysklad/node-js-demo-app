import type { Express, NextFunction, Request, Response } from "express";
import { config } from "../lib/config/config";
import { logMessage } from "../lib/observability/logger";
import { createConnectLoyaltyRouter, defaultLoyaltyProviderUrl } from "./connect/router";
import {
  describeLoyaltyConnection,
  LoyaltyInstallation,
  type LoyaltyConnectionState
} from "./domain/loyalty-installation";
import { SqliteLoyaltyInstallationRepository } from "./domain/loyalty-installation-sqlite-repository";
import { createLoyaltyProviderRouter } from "./provider/router";

/**
 * Точка подключения среза «Программа лояльности» к решению.
 * Все, что нужно ядру, — один вызов registerLoyalty(app); остальные касания общего кода
 * перечислены в src/loyalty/README.md и помечены меткой [feature:loyalty].
 */
export function registerLoyalty(app: Express): void {
  LoyaltyInstallation.configureRepository(new SqliteLoyaltyInstallationRepository(config.appDbPath));

  // Заглушка провайдера Loyalty API: эти методы вызывает МойСклад по токену подключения.
  app.use("/loyalty", createLoyaltyProviderRouter());
  // Backend вкладки: форма подключения шлет настройки сюда, рядом с /utils/update-settings.
  app.use("/utils", createConnectLoyaltyRouter());
  // Ошибки методов провайдера отдаем в формате Loyalty API: {"errors": [...]}.
  app.use(loyaltyApiErrorHandler);
}

/**
 * Данные вкладки «Программа лояльности» для рендера основного iframe.
 * Подключение опционально: на статус решения (SettingsRequired/Activated) оно не влияет.
 */
export function loyaltyIframeLocals(accountId: string): {
  loyalty: LoyaltyConnectionState;
  defaultLoyaltyProviderUrl: string;
} {
  return {
    loyalty: describeLoyaltyConnection(LoyaltyInstallation.load(config.appId, accountId)),
    defaultLoyaltyProviderUrl: defaultLoyaltyProviderUrl()
  };
}

function loyaltyApiErrorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent || !req.path.startsWith("/loyalty")) {
    next(error);
    return;
  }

  logMessage("ERROR", error instanceof Error ? error.stack ?? error.message : String(error));
  const status = getHttpErrorStatus(error);
  const message = status < 500 && error instanceof Error ? error.message : "Внутренняя ошибка провайдера";
  res.status(status).json({
    errors: [{ error: message, code: 999, error_message: message }]
  });
}

function getHttpErrorStatus(error: unknown): number {
  if (!error || typeof error !== "object") return 500;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const status = typeof candidate.status === "number" ? candidate.status : candidate.statusCode;
  return typeof status === "number" && status >= 400 && status < 500 ? status : 500;
}
