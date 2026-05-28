import { Router, type Request, type Response } from "express";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import type { SupportedEntity } from "../lib/domain/entities";
import { sendUnauthorized } from "../lib/http/http-responses";
import { jsonApi } from "../lib/integrations/json-api";
import { getUserContextFromLocals, loadUserContextMiddleware } from "../lib/session/user-context";

function buildGetObjectUrl(entity: SupportedEntity): string {
  return `/utils/get-object?entity=${encodeURIComponent(entity)}`;
}

function renderWidget(entity: SupportedEntity) {
  return (req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);

    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: не удалось получить контекст пользователя");
      return;
    }

    res.render("entry/widget", {
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
    let storesValues: string[] = [];

    if (context.isAdmin) {
      storesValues = await jsonApi(app.accessToken).storesNames();
    }

    res.render("entry/iframe", {
      accountId: context.accountId,
      isAdmin: context.isAdmin,
      uid: context.uid,
      fio: context.fio,
      contextNonce: context.contextNonce,
      infoMessage: app.infoMessage,
      store: app.store,
      isSettingsRequired: app.status !== AppStatus.ACTIVATED,
      storesValues
    });
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), renderWidget("customerorder"));
  router.get("/widget-invoiceout", loadUserContextMiddleware(), renderWidget("invoiceout"));

  router.get("/popup", (_req: Request, res: Response) => {
    res.render("entry/popup");
  });

  return router;
}
