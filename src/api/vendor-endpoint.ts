import { Router, type Request, type Response } from "express";
import { config } from "../lib/config/config";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
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

function replyAppStatus(
  res: Response,
  appId: string,
  accountId: string,
  status: string | null
): void {
  logMessage("INFO", `App appId=${appId} installed on accountId=${accountId}. Status: ${status}`);
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
    const hasRequiredSettings = config.loyaltyApiEnabled
      ? LoyaltyInstallation.load(appId, accountId) !== null
      : app.store.trim() !== "";

    if (accessToken) {
      app.accessToken = accessToken;
    }

    if (cause === "Resume") {
      app.status = hasRequiredSettings ? AppStatus.ACTIVATED : AppStatus.SETTINGS_REQUIRED;
    } else if (cause === "TariffChanged" || cause === "Autoprolongation") {
      // Сохраняем текущий статус: при смене тарифа обновление статуса в локальном хранилище не требуется.
    } else if (!app.getStatusName()) {
      app.status = hasRequiredSettings ? AppStatus.ACTIVATED : AppStatus.SETTINGS_REQUIRED;
    }

    app.persist();
    replyAppStatus(res, appId, accountId, app.getStatusName());
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
      // Отключаем интеграцию, но сохраняем участников и журнал бонусов как данные программы лояльности.
      LoyaltyInstallation.delete(appId, accountId);
      app.delete();
      logMessage("INFO", `App appId=${appId} deleted on accountId=${accountId}, cause=${cause}`);
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
