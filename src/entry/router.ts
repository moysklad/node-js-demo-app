import { Router, type Request, type Response } from "express";
import type { IframePageData } from "../features/entry/iframe/page-data";
import type { WidgetPageData } from "../features/entry/widget/page-data";
import { appVersion } from "../lib/config/app-version";
import { AppInstance } from "../lib/domain/app-instance";
import { describeAppStatus } from "../lib/domain/app-status-view";
import type { SupportedEntity } from "../lib/domain/entities";
import { sendBadRequest } from "../lib/http/http-responses";
import { sendPage } from "../lib/http/send-page";
import { jsonApi } from "../lib/integrations/json-api";
import { vendorApi } from "../lib/integrations/vendor-api";
import { roleToIsAdmin, saveActiveUserContextToSession, type UserContextSessionEntry } from "../lib/session/user-context";
import { loyaltyIframeLocals } from "../loyalty";

function buildGetObjectUrl(entity: SupportedEntity): string {
  return `/utils/get-object?entity=${encodeURIComponent(entity)}`;
}

async function buildIframePageData(context: UserContextSessionEntry): Promise<IframePageData> {
  const app = AppInstance.loadApp(context.accountId);
  const storesValues = context.isAdmin ? await jsonApi(app.accessToken).storesNames() : [];

  return {
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
}

function renderWidget(entity: SupportedEntity) {
  return (_req: Request, res: Response) => {
    const pageData: WidgetPageData = { getObjectUrl: buildGetObjectUrl(entity) };
    sendPage(res, { title: "Node Demo App widget", bundle: "widget", pageData });
  };
}

export function createEntryRouter(): Router {
  const router = Router();

  router.get("/iframe", (_req: Request, res: Response) => {
    sendPage(res, { title: "Node Demo App iframe", bundle: "iframe" });
  });

  router.post("/user-context", async (req: Request, res: Response) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";

    if (token === "") {
      sendBadRequest(res, "token обязателен");
      return;
    }

    const result = await vendorApi().exchangeUserContext(token);

    if (!result.ok) {
      res.status(toClientExchangeStatus(result.status)).json({
        message: "Не удалось получить контекст пользователя",
        ...(result.errorCode ? { code: result.errorCode } : {})
      });
      return;
    }

    const user = result.data;
    const isAdmin = roleToIsAdmin(user.role);
    const context = saveActiveUserContextToSession(req, {
      uid: user.userUid,
      fio: "",
      accountId: user.accountId,
      isAdmin
    });

    res.json({
      user: {
        accountId: user.accountId,
        userId: user.userId,
        userUid: user.userUid,
        role: user.role,
        isAdmin
      },
      contextNonce: context.contextNonce,
      ...(req.body?.page === "iframe" ? { pageData: await buildIframePageData(context) } : {})
    });
  });

  router.get("/widget-customerorder", renderWidget("customerorder"));
  router.get("/widget-invoiceout", renderWidget("invoiceout"));
  router.get("/popup", (_req: Request, res: Response) => {
    sendPage(res, { title: "Node Demo App popup", bundle: "popup" });
  });

  return router;
}

function toClientExchangeStatus(status: number): number {
  if (status === 401) {
    return 502;
  }

  return status >= 400 && status <= 599 ? status : 502;
}
