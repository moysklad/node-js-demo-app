import { Router, type Request, type Response } from "express";
import type { IframePageData } from "../features/entry/iframe/page-data";
import type { WidgetPageData } from "../features/entry/widget/page-data";
import { appVersion } from "../lib/config/app-version";
import { AppInstance } from "../lib/domain/app-instance";
import { describeAppStatus } from "../lib/domain/app-status-view";
import type { SupportedEntity } from "../lib/domain/entities";
import { loyaltyIframeLocals } from "../loyalty";
import { sendUnauthorized } from "../lib/http/http-responses";
import { sendPage } from "../lib/http/send-page";
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

    const pageData: WidgetPageData = {
      uid: context.uid,
      fio: context.fio,
      contextNonce: context.contextNonce,
      getObjectUrl: buildGetObjectUrl(entity)
    };
    sendPage(res, { title: "Node Demo App widget", bundle: "widget", pageData });
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
    const pageData: IframePageData = {
      accountId: context.accountId,
      isAdmin: context.isAdmin,
      uid: context.uid,
      fio: context.fio,
      contextNonce: context.contextNonce,
      infoMessage: app.infoMessage,
      store: app.store,
      appVersion: appVersion(),
      storesValues,
      status: describeAppStatus(app),
      // [feature:loyalty] программа лояльности: данные вкладки приходят из модуля src/loyalty,
      // на статус решения подключение не влияет.
      ...loyaltyIframeLocals(context.accountId)
    };
    sendPage(res, { title: "Node Demo App iframe", bundle: "iframe", pageData });
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), renderWidget("customerorder"));
  router.get("/widget-invoiceout", loadUserContextMiddleware(), renderWidget("invoiceout"));
  router.get("/popup", (_req: Request, res: Response) => {
    sendPage(res, { title: "Node Demo App popup", bundle: "popup" });
  });

  return router;
}
