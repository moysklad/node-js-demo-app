import { Router, type Request, type Response } from "express";
import { appVersion } from "../lib/config/app-version";
import { config } from "../lib/config/config";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import type { SupportedEntity } from "../lib/domain/entities";
import { LoyaltyInstallation } from "../lib/domain/loyalty-installation";
import { sendBadGateway, sendBadRequest, sendForbidden, sendUnauthorized } from "../lib/http/http-responses";
import { jsonApi } from "../lib/integrations/json-api";
import { vendorApi } from "../lib/integrations/vendor-api";
import {
  getUserContextFromLocals,
  loadActiveUserContextFromSession,
  loadUserContextMiddleware
} from "../lib/session/user-context";

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
      storesValues
    });
  });

  router.get("/loyalty", loadUserContextMiddleware(), (_req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);
    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: не удалось получить контекст пользователя");
      return;
    }

    res.render("entry/loyalty/view", {
      isAdmin: context.isAdmin,
      defaultProviderUrl: defaultLoyaltyProviderUrl()
    });
  });

  router.post("/loyalty/connect", ensureSessionUserContext(), async (req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);
    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe заново.");
      return;
    }
    if (!context.isAdmin) {
      sendForbidden(res);
      return;
    }

    const providerUrl = parseProviderUrl(req.body?.providerUrl);
    if (!providerUrl) {
      sendBadRequest(res, "Укажите корректный HTTP(S) URL провайдера Loyalty API");
      return;
    }

    const providerToken = parseProviderToken(req.body?.providerToken);
    const externalSearch = parseExternalSearch(req.body?.externalSearch);
    let installation = LoyaltyInstallation.load(config.appId, context.accountId);
    if (!installation) {
      installation = LoyaltyInstallation.create(config.appId, context.accountId, providerToken ?? undefined);
    } else if (providerToken) {
      installation.providerToken = providerToken;
    }

    const updated = await vendorApi().updateLoyaltySettings(config.appId, context.accountId, {
      url: providerUrl,
      token: installation.providerToken,
      externalSearch
    });
    if (!updated) {
      sendBadGateway(res, "Не удалось передать настройки Loyalty API");
      return;
    }
    const app = AppInstance.load(config.appId, context.accountId);
    if (app.status !== AppStatus.ACTIVATED) {
      const activated = await vendorApi().updateAppStatus(config.appId, context.accountId, "Activated");
      if (!activated) {
        sendBadGateway(res, "Не удалось активировать решение через Vendor API");
        return;
      }
      app.status = AppStatus.ACTIVATED;
      app.persist();
    }

    installation.externalSearch = externalSearch;
    installation.persist();

    res.json({
      message: "Настройки сформированы. Ниже показан PUT-запрос, который необходимо отправить через Vendor API.",
      externalSearch: installation.externalSearch
    });
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), renderWidget("customerorder"));
  router.get("/widget-invoiceout", loadUserContextMiddleware(), renderWidget("invoiceout"));
  router.get("/popup", (_req: Request, res: Response) => res.render("entry/popup/view"));

  return router;
}

function defaultLoyaltyProviderUrl(): string {
  return `${config.appBaseUrl.replace(/\/+$/, "")}/loyalty`;
}

function parseProviderUrl(value: unknown): string | null {
  const raw = typeof value === "string" && value.trim() ? value.trim() : defaultLoyaltyProviderUrl();
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function parseExternalSearch(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "on" || value === "1";
  }
  return false;
}

function parseProviderToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token ? token : null;
}

function ensureSessionUserContext() {
  return (req: Request, res: Response, next: () => void) => {
    const context = loadActiveUserContextFromSession(req);
    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe заново.");
      return;
    }
    res.locals.userContext = context;
    next();
  };
}
