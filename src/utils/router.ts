import { Router, type Request, type Response } from "express";
import { AppInstance, AppStatus, hasRequiredSettings } from "../lib/domain/app-instance";
import { describeAppStatus } from "../lib/domain/app-status-view";
import { config } from "../lib/config/config";
import { entitiesMap, isSupportedEntity } from "../lib/domain/entities";
import { sendBadGateway, sendBadRequest, sendUnauthorized, sendForbidden } from "../lib/http/http-responses";
import { getStringQueryParam } from "../lib/http/http-values";
import { jsonApi } from "../lib/integrations/json-api";
import { logMessage } from "../lib/observability/logger";
import { resolveBackendContextFromSession } from "../lib/session/user-context";
import { vendorApi } from "../lib/integrations/vendor-api";

export function createUtilsRouter(): Router {
  const router = Router();

  router.post("/update-settings", async (req: Request, res: Response) => {
    const authContext = resolveBackendContextFromSession(req);

    if (!authContext) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe заново.");
      return;
    }

    if (!authContext.isAdmin) {
      sendForbidden(res);
      return;
    }

    const infoMessage = String(req.body?.infoMessage ?? "").trim();
    const store = String(req.body?.store ?? "").trim();

    logMessage("INFO", `Update settings: ${infoMessage}, store: ${store}`);

    const accountId = authContext.accountId;
    const app = AppInstance.loadApp(accountId);

    app.infoMessage = infoMessage;
    app.store = store;
    app.status = hasRequiredSettings(app) ? AppStatus.ACTIVATED : AppStatus.SETTINGS_REQUIRED;

    const statusUpdateResult = await vendorApi().updateAppStatus(config.appId, accountId, app.getStatusName() ?? "");

    if (!statusUpdateResult) {
      sendBadGateway(res, "Не удалось обновить статус приложения во внешнем Vendor API");
      return;
    }

    app.persist();

    res.json({
      message: "Настройки обновлены",
      status: describeAppStatus(app)
    });
  });

  /**
   * Один запрос списка складов с числом повторов по X-Lognex-Retry-After.
   * Форма проверки ретраев в iframe вызывает endpoint серией: размер серии задает клиент,
   * сервер о ней не знает и параметр requestCount не читает.
   */
  router.post("/stores", async (req: Request, res: Response) => {
    const authContext = resolveBackendContextFromSession(req);

    if (!authContext) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe заново.");
      return;
    }

    if (!authContext.isAdmin) {
      sendForbidden(res);
      return;
    }

    const app = AppInstance.loadApp(authContext.accountId);
    const { stores, retries } = await jsonApi(app.accessToken).storesWithRetries();
    const success = stores !== null;

    // Ответ всегда JSON, в том числе на 502: клиенту нужно число ретраев даже у неудачных запросов.
    res.status(success ? 200 : 502).json({
      message: success ? "Запрос выполнен" : "Не удалось получить список складов",
      success,
      retries
    });
  });

  router.post("/get-object", async (req: Request, res: Response) => {
    const authContext = resolveBackendContextFromSession(req);

    if (!authContext) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe/виджет заново.");
      return;
    }

    const entity = getStringQueryParam(req, "entity");
    const objectId = String(req.body?.objectId ?? "").trim();

    if (!isSupportedEntity(entity)) {
      sendBadRequest(res, "Неподдерживаемая сущность");
      return;
    }

    if (objectId === "") {
      sendBadRequest(res, "objectId обязателен");
      return;
    }

    const accountId = authContext.accountId;
    const app = AppInstance.loadApp(accountId);
    const object = await jsonApi(app.accessToken).getObject(entity, objectId);

    if (!object || !object.name) {
      sendBadGateway(res, "Не удалось получить объект");
      return;
    }

    res.send(`${entitiesMap[entity]} ${object.name}`);
  });

  return router;
}
