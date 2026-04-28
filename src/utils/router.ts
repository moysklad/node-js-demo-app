import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AppInstance, AppStatus } from "../lib/app-instance";
import { cfg } from "../lib/config";
import { entitiesMap, isSupportedEntity } from "../lib/entities";
import { sendBadGateway, sendBadRequest, sendForbidden, sendUnauthorized } from "../lib/http-responses";
import { jsonApi } from "../lib/json-api";
import { logMessage } from "../lib/logger";
import { resolveBackendContextFromSession } from "../lib/user-context";
import { vendorApi } from "../lib/vendor-api";

const updateSettingsPayloadSchema = z.object({
  infoMessage: z.string().max(1000).optional(),
  store: z.string().max(255).optional()
});

export function createUtilsRouter(): Router {
  const router = Router();

  router.post("/update-settings", async (req: Request, res: Response) => {
    const authContext = resolveBackendContextFromSession(req);

    if (!authContext) {
      sendUnauthorized(res, "Ошибка авторизации: передайте contextKey и откройте iframe заново.");
      return;
    }

    if (!authContext.isAdmin) {
      sendForbidden(res);
      return;
    }

    const payload = updateSettingsPayloadSchema.parse(req.body);
    const infoMessage = String(payload.infoMessage ?? "").trim();
    const store = String(payload.store ?? "").trim();

    logMessage("INFO", `Update settings: ${infoMessage}, store: ${store}`);

    const accountId = authContext.accountId;
    const app = AppInstance.loadApp(accountId);

    app.infoMessage = infoMessage;
    app.store = store;
    app.status = AppStatus.ACTIVATED;

    const statusUpdateResult = await vendorApi().updateAppStatus(cfg().appId, accountId, app.getStatusName() ?? "");

    if (!statusUpdateResult) {
      sendBadGateway(res, "Не удалось обновить статус приложения во внешнем Vendor API");
      return;
    }

    app.persist();

    res.send("Настройки обновлены, перезагрузите решение");
  });

  router.get("/get-object", async (req: Request, res: Response) => {
    const authContext = resolveBackendContextFromSession(req);

    if (!authContext) {
      sendUnauthorized(res, "Ошибка авторизации: передайте contextKey и откройте iframe/виджет заново.");
      return;
    }

    const entity = typeof req.query.entity === "string" ? req.query.entity.trim() : "";
    const objectId = typeof req.query.objectId === "string" ? req.query.objectId.trim() : "";

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
