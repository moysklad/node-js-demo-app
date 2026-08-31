import { Router, type Request, type Response } from "express";
import { appVersion } from "../lib/config/app-version";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import type { SupportedEntity } from "../lib/domain/entities";
import { sendBadRequest, sendUnauthorized } from "../lib/http/http-responses";
import { jsonApi } from "../lib/integrations/json-api";
import { vendorApi } from "../lib/integrations/vendor-api";
import {
  getContextKeyFromRequest,
  getUserContextFromLocals,
  loadUserContextMiddleware,
  roleToIsAdmin,
  saveActiveUserContextToSession,
  type UserContextSessionEntry
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
  const legacyUserContextMiddleware = loadUserContextMiddleware();

  router.get(
    "/iframe",
    (req, res, next) => {
      if (getContextKeyFromRequest(req) !== null) {
        legacyUserContextMiddleware(req, res, next);
        return;
      }

      next();
    },
    async (_req: Request, res: Response) => {
      const context = getUserContextFromLocals(res);

      if (!context) {
        await renderIframe(res, null);
        return;
      }

      await renderIframe(res, context);
    }
  );

  router.post("/user-context", async (req: Request, res: Response) => {
    let token = typeof req.body?.token === "string" ? req.body.token.trim() : "";

    if (req.body && typeof req.body === "object") {
      delete (req.body as Record<string, unknown>).token;
    }

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
    const app = AppInstance.loadApp(user.accountId);
    const storesValues = isAdmin ? await jsonApi(app.accessToken).storesNames() : [];

    res.json({
      user: {
        accountId: user.accountId,
        userId: user.userId,
        userUid: user.userUid,
        role: user.role,
        isAdmin
      },
      contextNonce: context.contextNonce,
      app: {
        infoMessage: app.infoMessage,
        store: app.store,
        isSettingsRequired: app.status !== AppStatus.ACTIVATED,
        storesValues
      }
    });
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), renderWidget("customerorder"));
  router.get("/widget-invoiceout", loadUserContextMiddleware(), renderWidget("invoiceout"));

  router.get("/popup", (_req: Request, res: Response) => {
    res.render("entry/popup/view");
  });

  return router;
}

async function renderIframe(res: Response, context: UserContextSessionEntry | null): Promise<void> {
  const app = context ? AppInstance.loadApp(context.accountId) : null;
  const storesValues =
    context?.isAdmin && app ? await jsonApi(app.accessToken).storesNames() : [];

  res.render("entry/iframe/view", {
    awaitingContext: context === null,
    accountId: context?.accountId ?? "",
    isAdmin: context?.isAdmin ?? false,
    uid: context?.uid ?? "",
    fio: context?.fio ?? "",
    contextNonce: context?.contextNonce ?? "",
    infoMessage: app?.infoMessage ?? "",
    store: app?.store ?? "",
    isSettingsRequired: app?.status !== AppStatus.ACTIVATED,
    appVersion: appVersion(),
    storesValues
  });
}

function toClientExchangeStatus(status: number): number {
  return status >= 400 && status <= 599 ? status : 502;
}
