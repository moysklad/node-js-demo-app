import { Router, type Request, type Response } from "express";
import { appVersion } from "../lib/config/app-version";
import { config } from "../lib/config/config";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import type { SupportedEntity } from "../lib/domain/entities";
import { Loyalty } from "../lib/domain/loyalty";
import type { VendorApiLoyaltyData, VendorApiLoyaltyPatch } from "../lib/domain/types";
import { sendBadGateway, sendBadRequest, sendForbidden, sendUnauthorized } from "../lib/http/http-responses";
import { jsonApi } from "../lib/integrations/json-api";
import { vendorApi } from "../lib/integrations/vendor-api";
import { getUserContextFromLocals, loadActiveUserContextFromSession, loadUserContextMiddleware } from "../lib/session/user-context";

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
    const loyalty = Loyalty.load(config.appId, context.accountId);
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
      vendorApiRequestUrl: "/entry/vendor-api",
      infoMessage: app.infoMessage,
      store: app.store,
      isSettingsRequired: app.status !== AppStatus.ACTIVATED,
      appVersion: appVersion(),
      storesValues,
      loyalty,
      loyaltyDataJson: JSON.stringify({
        url: loyalty.loyaltyProviderUrl,
        token: loyalty.loyaltyEncryptedKey,
        externalSearch: loyalty.loyaltyExternalCustomers
      }, null, 2)
    });
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), renderWidget("customerorder"));
  router.get("/widget-invoiceout", loadUserContextMiddleware(), renderWidget("invoiceout"));

  router.get("/popup", (_req: Request, res: Response) => {
    res.render("entry/popup/view");
  });

  router.put("/vendor-api/loyalty", ensureSessionUserContext(), updateLoyaltySettings("PUT"));
  router.patch("/vendor-api/loyalty", ensureSessionUserContext(), updateLoyaltySettings("PATCH"));

  return router;
}

function updateLoyaltySettings(method: "PUT" | "PATCH") {
  return async (req: Request, res: Response): Promise<void> => {
    const context = getUserContextFromLocals(res);

    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe заново.");
      return;
    }

    if (!context.isAdmin) {
      sendForbidden(res);
      return;
    }

    const data = method === "PUT" ? parseFullLoyaltyData(req.body) : parsePartialLoyaltyData(req.body);

    if (!data) {
      sendBadRequest(res, `Некорректные данные для ${method} настроек loyalty`);
      return;
    }

    const succeeded = method === "PUT"
      ? await vendorApi().updateLoyaltySettings(config.appId, context.accountId, data as VendorApiLoyaltyData)
      : await vendorApi().updateLoyaltySettingsPartially(config.appId, context.accountId, data);

    if (!succeeded) {
      sendBadGateway(res, "Не удалось обновить настройки loyalty через Vendor API");
      return;
    }

    const loyalty = Loyalty.upsert(context.accountId, config.appId, {
      ...(data.url !== undefined ? { loyaltyProviderUrl: data.url } : {}),
      ...(data.token !== undefined ? { loyaltyEncryptedKey: data.token } : {}),
      ...(data.externalSearch !== undefined ? { loyaltyExternalCustomers: data.externalSearch } : {})
    });

    res.json({
      message: "Настройки loyalty обновлены",
      loyalty: {
        url: loyalty.loyaltyProviderUrl,
        token: loyalty.loyaltyEncryptedKey,
        externalSearch: loyalty.loyaltyExternalCustomers
      }
    });
  };
}

function parseFullLoyaltyData(rawBody: unknown): VendorApiLoyaltyData | null {
  if (!isRecord(rawBody)) {
    return null;
  }

  const url = typeof rawBody.url === "string" ? rawBody.url.trim() : "";
  const token = typeof rawBody.token === "string" ? rawBody.token.trim() : "";

  if (url === "" || token === "" || typeof rawBody.externalSearch !== "boolean") {
    return null;
  }

  return { url, token, externalSearch: rawBody.externalSearch };
}

function parsePartialLoyaltyData(rawBody: unknown): VendorApiLoyaltyPatch | null {
  if (!isRecord(rawBody)) {
    return null;
  }

  const data: VendorApiLoyaltyPatch = {};

  if (Object.hasOwn(rawBody, "url")) {
    if (typeof rawBody.url !== "string") {
      return null;
    }
    data.url = rawBody.url.trim();
  }

  if (Object.hasOwn(rawBody, "token")) {
    if (typeof rawBody.token !== "string") {
      return null;
    }
    data.token = rawBody.token.trim();
  }

  if (Object.hasOwn(rawBody, "externalSearch")) {
    if (typeof rawBody.externalSearch !== "boolean") {
      return null;
    }
    data.externalSearch = rawBody.externalSearch;
  }

  return Object.keys(data).length > 0 ? data : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
