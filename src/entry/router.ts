import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { appVersion } from "../lib/config/app-version";
import { config } from "../lib/config/config";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import type { SupportedEntity } from "../lib/domain/entities";
import { Loyalty } from "../lib/domain/loyalty";
import { LoyaltyAccount } from "../lib/domain/loyalty-account";
import { vendorApi } from "../lib/integrations/vendor-api";
import { sendBadGateway, sendBadRequest, sendForbidden, sendUnauthorized } from "../lib/http/http-responses";
import { jsonApi } from "../lib/integrations/json-api";
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

  router.get("/loyalty", loadUserContextMiddleware(), (req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);
    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: не удалось получить контекст пользователя");
      return;
    }

    const account = LoyaltyAccount.load(config.appId, context.accountId);
    const isLoyaltyAuthenticated = Boolean(account)
      && req.session.loyaltyAuthenticatedAccountId === context.accountId;
    res.render("entry/loyalty/view", {
      isAdmin: context.isAdmin,
      uid: context.uid,
      fio: context.fio,
      account,
      isConfigured: Boolean(account),
      isLoyaltyAuthenticated,
      contextNonce: context.contextNonce
    });
  });

  router.post("/loyalty/account", ensureSessionUserContext(), async (req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);
    if (!context) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe заново.");
      return;
    }
    if (!context.isAdmin) {
      sendForbidden(res);
      return;
    }

    const login = typeof req.body?.login === "string" ? req.body.login.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (login.length < 3 || password.length < 3) {
      sendBadRequest(res, "Логин и пароль должны содержать минимум 3 символа");
      return;
    }

    let account = LoyaltyAccount.load(config.appId, context.accountId);
    let accountCreated = false;
    if (!account) {
      if (login !== config.loyaltyDemoLogin || password !== config.loyaltyDemoPassword) {
        sendUnauthorized(res, "Неверный логин или пароль");
        return;
      }
      account = LoyaltyAccount.register(config.appId, context.accountId, config.loyaltyDemoLogin, config.loyaltyDemoPassword, false);
      accountCreated = true;
    } else if (account.login !== login || !LoyaltyAccount.verifyPassword(account, password)) {
      sendUnauthorized(res, "Неверный логин или пароль");
      return;
    }

    const providerUrl = `${config.appBaseUrl}/loyalty`;
    const updated = await vendorApi().updateLoyaltySettings(config.appId, context.accountId, {
      url: providerUrl,
      token: account.token,
      externalSearch: false
    });
    if (!updated) {
      sendBadGateway(res, "Не удалось подключить loyalty через Vendor API");
      return;
    }

    const activated = await vendorApi().updateAppStatus(config.appId, context.accountId, "Activated");
    if (!activated) {
      sendBadGateway(res, "Не удалось активировать решение через Vendor API");
      return;
    }

    if (accountCreated) {
      account.persist();
    }

    req.session.loyaltyAuthenticatedAccountId = context.accountId;

    const loyalty = Loyalty.upsert(context.accountId, config.appId, {
      loyaltyProviderUrl: providerUrl,
      loyaltyEncryptedKey: account.token,
      loyaltyExternalCustomers: false
    });

    res.json({
      message: "Loyalty подключена",
      account: { login: account.login },
      loyalty: { url: loyalty.loyaltyProviderUrl, externalSearch: loyalty.loyaltyExternalCustomers }
    });
  });

  router.post("/loyalty/action", ensureSessionUserContext(), async (req: Request, res: Response) => {
    const context = getUserContextFromLocals(res);
    const account = context && LoyaltyAccount.load(config.appId, context.accountId);
    if (!context || !account || !req.session.loyaltyAuthenticatedAccountId || !context.isAdmin) {
      sendUnauthorized(res, "Сначала войдите в loyalty");
      return;
    }
    const app = AppInstance.loadApp(context.accountId);
    try {
      if (req.body?.action === "search") {
        const result = await jsonApi(app.accessToken).searchCounterparties(String(req.body.search ?? ""));
        res.json(result ?? { rows: [] });
        return;
      }
      if (req.body?.action === "create") {
        const data = { ...(req.body.data ?? {}) } as Record<string, unknown>;
        if (typeof data.name !== "string" || data.name.trim() === "") {
          sendBadRequest(res, "Укажите имя контрагента");
          return;
        }
        if (typeof data.discountCardNumber !== "string" || data.discountCardNumber.trim() === "") {
          data.discountCardNumber = `DEMO-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
        }
        const result = await jsonApi(app.accessToken).upsertCounterparty(data);
        if (!result) {
          sendBadGateway(res, "JSON API не вернул созданного контрагента");
          return;
        }
        res.status(201).json(result);
        return;
      }
      sendBadRequest(res, "Неизвестное действие");
    } catch {
      sendBadGateway(res, "Не удалось выполнить действие loyalty");
    }
  });

  router.get("/widget-customerorder", loadUserContextMiddleware(), renderWidget("customerorder"));
  router.get("/widget-invoiceout", loadUserContextMiddleware(), renderWidget("invoiceout"));

  router.get("/popup", (_req: Request, res: Response) => {
    res.render("entry/popup/view");
  });

  return router;
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
