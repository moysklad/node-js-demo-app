import { Router, type Request, type Response } from "express";
import { AppInstance, AppStatus, hasRequiredSettings } from "../lib/domain/app-instance";
import { LoyaltyInstallation } from "../lib/domain/loyalty-installation";
import { sendBadRequest, sendUnauthorized } from "../lib/http/http-responses";
import { getStringRouteParam } from "../lib/http/http-values";
import { logMessage } from "../lib/observability/logger";
import { authTokenIsValid } from "../lib/integrations/vendor-api";
import {
  processDocumentButtonClick,
  processListButtonClick,
  type ButtonUser,
  type DocumentButtonName,
  type ListButtonObject
} from "./button";

const vendorEndpointAppRoutePath = "/api/moysklad/vendor/1.0/apps/:appId/:accountId";
const vendorEndpointButtonRoutePath = `${vendorEndpointAppRoutePath}/button`;
const vendorEndpointEventRoutePath = `${vendorEndpointAppRoutePath}/event`;

type VendorRouteContext = {
  appId: string;
  accountId: string;
};

type VendorCallbackBody = {
  appUid?: string;
  cause?: string;
  access?: Array<{ access_token?: string }>;
  buttonName?: DocumentButtonName;
  extensionPoint?: string;
  objectId?: string;
  selected?: ListButtonObject[];
  user?: ButtonUser;
};

function getVendorRouteContext(req: Request): VendorRouteContext {
  return {
    appId: getStringRouteParam(req, "appId"),
    accountId: getStringRouteParam(req, "accountId")
  };
}

function loadInstalledAppOrReply204(res: Response, appId: string, accountId: string): AppInstance | null {
  const app = AppInstance.load(appId, accountId);

  if (!app.isInstalled()) {
    logMessage("INFO", `App appId=${appId} not installed on accountId=${accountId}`);
    res.status(204).end();
    return null;
  }

  return app;
}

/**
 * Сбрасывает признак того, что МойСклад знает о подключении Loyalty API, сохраняя токен.
 */
function resetLoyaltyConnection(appId: string, accountId: string): void {
  const installation = LoyaltyInstallation.load(appId, accountId);

  if (!installation || !installation.isConnected()) {
    return;
  }

  installation.markDisconnected();
  installation.persist();
  logMessage("INFO", `Loyalty connection reset for appId=${appId} on accountId=${accountId}`);
}

function replyAppStatus(
  res: Response,
  appId: string,
  accountId: string,
  status: string | null,
  settingsRestored = false
): void {
  const restoredNote = settingsRestored ? " with restored settings" : "";
  logMessage(
    "INFO",
    `App appId=${appId} installed on accountId=${accountId}${restoredNote}. Status: ${status}`
  );
  res.json({ status });
}

export function createVendorEndpointRouter(): Router {
  const router = Router();

  router.use(vendorEndpointAppRoutePath, (req, res, next) => {
    if (!authTokenIsValid(req.headers)) {
      sendUnauthorized(res);
      return;
    }

    next();
  });

  router.put(vendorEndpointAppRoutePath, (req: Request, res: Response) => {
    const { appId, accountId } = getVendorRouteContext(req);

    const body = getVendorCallbackBody(req);
    const cause = body.cause ?? "";
    const accessToken = body.access?.[0]?.access_token ?? "";
    const app = AppInstance.load(appId, accountId);
    const settingsReady = hasRequiredSettings(app);
    let settingsRestored = false;

    if (accessToken) {
      app.accessToken = accessToken;
    }

    if (cause === "Install") {
      // Настройки предыдущей установки сохраняются при удалении решения, поэтому при повторной
      // установке решение сразу готово к работе и пользователю не нужно настраивать его заново.
      settingsRestored = settingsReady;
      app.status = settingsReady ? AppStatus.ACTIVATED : AppStatus.SETTINGS_REQUIRED;
      // Настройки Loyalty API живут на стороне МоегоСклада и удаляются вместе с решением,
      // поэтому сохраненный токен нужно передать через Vendor API заново.
      resetLoyaltyConnection(appId, accountId);
    } else if (cause === "Resume") {
      // Приостановка временная: настройки не удалялись, решение продолжает работу с прежней конфигурацией.
      app.status = settingsReady ? AppStatus.ACTIVATED : AppStatus.SETTINGS_REQUIRED;
    } else if (cause === "TariffChanged" || cause === "Autoprolongation") {
      // Сохраняем текущий статус: при смене тарифа обновление статуса в локальном хранилище не требуется.
    } else if (!app.getStatusName()) {
      app.status = settingsReady ? AppStatus.ACTIVATED : AppStatus.SETTINGS_REQUIRED;
    }

    app.persist();
    replyAppStatus(res, appId, accountId, app.getStatusName(), settingsRestored);
  });

  router.post(vendorEndpointButtonRoutePath, (req: Request, res: Response) => {
    const body = getVendorCallbackBody(req);
    const extensionPoint = body.extensionPoint ?? "";

    if (body.buttonName && body.objectId) {
      res.json(processDocumentButtonClick(body.buttonName, extensionPoint, body.objectId, body.user));
    } else if (body.selected && body.buttonName === "show-notification") {
      res.json(processListButtonClick(body.buttonName, extensionPoint, body.selected));
    } else {
      res.json({});
    }
  });

  router.delete(vendorEndpointAppRoutePath, (req: Request, res: Response) => {
    const { appId, accountId } = getVendorRouteContext(req);

    const app = loadInstalledAppOrReply204(res, appId, accountId);
    if (!app) {
      return;
    }

    const body = getVendorCallbackBody(req);
    const cause = body.cause;

    if (cause === "Uninstall") {
      // Решение удалено с аккаунта. Пользовательские настройки сохраняем, чтобы при повторной
      // установке не заставлять пользователя настраивать решение заново. Если политика хранения
      // данных требует обратного, вызовите здесь app.delete() и LoyaltyInstallation.delete().
      app.uninstall();
      // Токен Loyalty API оставляем: он переиспользуется при повторном подключении.
      // Приостановка решения настройки лояльности в МоемСкладе не удаляет, поэтому сбрасываем
      // признак подключения только здесь.
      resetLoyaltyConnection(appId, accountId);
      logMessage("INFO", `App appId=${appId} uninstalled on accountId=${accountId}, settings kept, cause=${cause}`);
    } else if (cause === "Suspend") {
      app.suspend();
      logMessage("INFO", `App appId=${appId} suspended on accountId=${accountId}, cause=${cause}`);
    } else {
      sendBadRequest(res, "Invalid delete request");
      return;
    }

    res.status(200).end();
  });

  router.put(vendorEndpointEventRoutePath, (req: Request, res: Response) => {
    const { appId, accountId } = getVendorRouteContext(req);
    const app = loadInstalledAppOrReply204(res, appId, accountId);
    if (!app) {
      return;
    }

    const body = getVendorCallbackBody(req);

    if (body.cause === "PermissionsChanged") {
      logMessage("INFO", `Permissions changed for appId=${appId} on accountId=${accountId}`, {
        accessItems: Array.isArray(body.access) ? body.access.length : 0
      });
    }

    res.status(200).end();
  });

  return router;
}

function getVendorCallbackBody(req: Request): VendorCallbackBody {
  return (req.body ?? {}) as VendorCallbackBody;
}
