import { Router, type Request, type Response } from "express";
import { appVersion } from "../lib/config/app-version";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import type { SupportedEntity } from "../lib/domain/entities";
import { sendBadRequest, sendUnauthorized } from "../lib/http/http-responses";
import { jsonApi } from "../lib/integrations/json-api";
import { vendorApi } from "../lib/integrations/vendor-api";
import {
  checkIsAdmin,
  getUserContextFromLocals,
  loadUserContextMiddleware,
  saveActiveUserContextToSession
} from "../lib/session/user-context";

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
    let storesValues: string[] = [];

    if (context.isAdmin) {
      storesValues = await jsonApi(app.accessToken).storesNames();
    }

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
      storesValues
    });
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), renderWidget("customerorder"));
  router.get("/widget-invoiceout", loadUserContextMiddleware(), renderWidget("invoiceout"));

  router.get("/popup", (_req: Request, res: Response) => {
    res.render("entry/popup/view");
  });

  // UserContext2: iframe присылает одноразовый opaque-токен, полученный у хоста,
  // а бэкенд обменивает его в Vendor API на контекст пользователя. Токен одноразовый — на
  // каждый обмен нужен свой токен.
  router.post("/user-context/exchange", async (req: Request, res: Response) => {
    const token = String(req.body?.token ?? "").trim();
    const mode = req.body?.mode === "expand" ? "expand" : "user";

    if (token === "") {
      sendBadRequest(res, "token обязателен");
      return;
    }

    if (mode === "user") {
      const result = await vendorApi().exchangeUserContext(token);

      if (!result.ok) {
        res.status(exchangeErrorStatus(result.status)).json({ status: result.status, code: result.errorCode });
        return;
      }

      // TODO: краткий контекст сессию не поднимает — в нём нет permissions/isAdmin.
      // Для рабочего сценария с сессией и contextNonce используется expand ниже.
      res.json({ mode, ...result.data });
      return;
    }

    const result = await vendorApi().expandUserContext(token);

    if (!result.ok) {
      res.status(exchangeErrorStatus(result.status)).json({ status: result.status, code: result.errorCode });
      return;
    }

    const employee = result.data;
    // Поднимаем сессию из расширенного контекста, чтобы форма настроек (contextNonce) работала.
    const context = saveActiveUserContextToSession(req, {
      uid: employee.uid,
      fio: employee.shortFio ?? "",
      accountId: employee.accountId,
      isAdmin: checkIsAdmin(employee)
    });

    res.json({
      mode,
      accountId: employee.accountId,
      uid: employee.uid,
      fio: employee.shortFio ?? "",
      isAdmin: context.isAdmin,
      contextNonce: context.contextNonce,
      employee
    });
  });

  return router;
}

function exchangeErrorStatus(zeusStatus: number): number {
  return zeusStatus >= 400 ? zeusStatus : 502;
}
