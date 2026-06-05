import { Router, type Request, type Response } from "express";
import { appVersion } from "../lib/config/app-version";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import { entitiesMap, isSupportedEntity } from "../lib/domain/entities";
import { sendBadGateway, sendBadRequest, sendForbidden, sendUnauthorized } from "../lib/http/http-responses";
import { getStringQueryParam } from "../lib/http/http-values";
import { jsonApi } from "../lib/integrations/json-api";
import { logMessage } from "../lib/observability/logger";
import { loadActiveUserContextFromSession, resolveBackendContextFromSession } from "../lib/session/user-context";
import { vendorApi } from "../lib/integrations/vendor-api";
import { config } from "../lib/config/config";

function hasRequiredSettings(app: AppInstance): boolean {
  return app.store.trim() !== "";
}

export function createUtilsRouter(): Router {
  const router = Router();

  router.get("/entry-context/iframe", async (req: Request, res: Response) => {
    const context = loadActiveUserContextFromSession(req);

    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe заново.");
      return;
    }

    const app = AppInstance.loadApp(context.accountId);
    let storesValues: string[] = [];

    if (context.isAdmin) {
      storesValues = await jsonApi(app.accessToken).storesNames();
    }

    res.json({
      accountId: context.accountId,
      appVersion: appVersion(),
      contextNonce: context.contextNonce,
      fio: context.fio,
      infoMessage: app.infoMessage,
      isAdmin: context.isAdmin,
      isSettingsRequired: app.status !== AppStatus.ACTIVATED,
      store: app.store,
      storesValues,
      uid: context.uid,
    });
  });

  router.get("/entry-context/widget", (req: Request, res: Response) => {
    const context = loadActiveUserContextFromSession(req);

    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: откройте виджет заново.");
      return;
    }

    const entity = getStringQueryParam(req, "entity");

    if (!isSupportedEntity(entity)) {
      sendBadRequest(res, "Неподдерживаемая сущность");
      return;
    }

    res.json({
      contextNonce: context.contextNonce,
      entity,
      fio: context.fio,
      getObjectUrl: `/utils/get-object?entity=${encodeURIComponent(entity)}`,
      uid: context.uid,
    });
  });

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

    const isSettingsRequired = app.status !== AppStatus.ACTIVATED;

    res.json({
      message: "Настройки обновлены",
      status: {
        className: isSettingsRequired ? "status-required" : "status-ready",
        title: isSettingsRequired ? "ТРЕБУЕТСЯ НАСТРОЙКА" : "РЕШЕНИЕ ГОТОВО К РАБОТЕ",
        showDetails: !isSettingsRequired,
        infoMessage: app.infoMessage,
        store: app.store,
      },
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
