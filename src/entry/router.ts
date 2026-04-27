import { Router, type Request, type Response } from "express";
import { AppInstance, AppStatus } from "../lib/app-instance";
import type { SupportedEntity } from "../lib/entities";
import { jsonApi } from "../lib/json-api";
import type { MoyskladStoreListResponse } from "../lib/types";
import { getUserContextFromLocals, loadUserContextMiddleware } from "../lib/user-context";

function buildGetObjectUrl(entity: SupportedEntity, contextKey: string): string {
  return `/utils/get-object?entity=${encodeURIComponent(entity)}&contextKey=${encodeURIComponent(contextKey)}&objectId=`;
}

function extractStoreNames(stores: MoyskladStoreListResponse | null): string[] {
  if (!Array.isArray(stores?.rows)) {
    return [];
  }

  const names: string[] = [];

  for (const store of stores.rows) {
    if (store?.name) {
      names.push(store.name);
    }
  }

  return names;
}

function sendUnauthorized(res: Response, message: string): void {
  res.status(401).send(message);
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
      contextKey: context.contextKey,
      getObjectUrl: buildGetObjectUrl(entity, context.contextKey)
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
      storesValues = extractStoreNames(await jsonApi(app.accessToken).stores());
    }

    res.render("entry/iframe", {
      accountId: context.accountId,
      isAdmin: context.isAdmin,
      uid: context.uid,
      fio: context.fio,
      contextKey: context.contextKey,
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
