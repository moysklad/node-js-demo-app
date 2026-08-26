import { Router, type Request, type Response } from "express";
import { appVersion } from "../lib/config/app-version";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import type { SupportedEntity } from "../lib/domain/entities";
import { loyaltyIframeLocals } from "../loyalty";
import { sendUnauthorized } from "../lib/http/http-responses";
import { jsonApi } from "../lib/integrations/json-api";
import { getUserContextFromLocals, loadUserContextMiddleware } from "../lib/session/user-context";

function buildGetObjectUrl(entity: SupportedEntity): string {
  return `/utils/get-object?entity=${encodeURIComponent(entity)}`;
}

function renderWidget(entity: SupportedEntity) {
  return (_req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);
    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: не удалось получить контекст пользователя");
      return;
    }

    res.render("entry/widget/view", {
      uid: context.uid,
      fio: context.fio,
      contextNonce: context.contextNonce,
      getObjectUrl: buildGetObjectUrl(entity)
    });
  };
}

export function createEntryRouter(): Router {
  const router = Router();

  router.get("/iframe", loadUserContextMiddleware(), async (_req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);
    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: не удалось получить контекст пользователя");
      return;
    }

    const app = AppInstance.loadApp(context.accountId);
    const storesValues = context.isAdmin ? await jsonApi(app.accessToken).storesNames() : [];
    res.render("entry/iframe/view", {
      accountId: context.accountId,
      isAdmin: context.isAdmin,
      uid: context.uid,
      fio: context.fio,
      contextNonce: context.contextNonce,
      infoMessage: app.infoMessage,
      store: app.store,
      isSettingsRequired: app.status !== AppStatus.ACTIVATED,
      appVersion: appVersion(),
      storesValues,
      // [feature:loyalty] Данные вкладки «Программа лояльности». Подключение необязательно
      // и на статус решения не влияет; состояние целиком приходит из среза src/loyalty.
      ...loyaltyIframeLocals(context.accountId)
    });
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), renderWidget("customerorder"));
  router.get("/widget-invoiceout", loadUserContextMiddleware(), renderWidget("invoiceout"));
  router.get("/popup", (_req: Request, res: Response) => {
    res.render("entry/popup/view");
  });

  return router;
}
