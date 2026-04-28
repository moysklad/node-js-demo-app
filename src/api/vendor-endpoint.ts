import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AppInstance, AppStatus } from "../lib/domain/app-instance";
import { cfg } from "../lib/config/config";
import { sendBadRequest, sendUnauthorized } from "../lib/http/http-responses";
import { getStringRouteParam } from "../lib/http/http-values";
import { logMessage } from "../lib/observability/logger";
import { redactSensitiveValue } from "../lib/security/security";
import { authTokenIsValid } from "../lib/integrations/vendor-api";
import { allButtonNames, processDocumentButtonClick, processListButtonClick } from "./button";

const vendorEndpointAppRoutePath = "/api/moysklad/vendor/1.0/apps/:appId/:accountId";
const vendorEndpointButtonRoutePath = `${vendorEndpointAppRoutePath}/button`;
const vendorEndpointEventRoutePath = `${vendorEndpointAppRoutePath}/event`;

const installPayloadSchema = z.object({
  appUid: z.string().min(1),
  access: z.array(
    z.object({
      access_token: z.string().min(1)
    })
  ).min(1)
});

const buttonPayloadSchema = z.object({
  buttonName: z.enum(allButtonNames),
  extensionPoint: z.string().min(1),
  objectId: z.string().min(1).optional(),
  selected: z.array(z.object({ id: z.string().min(1) })).optional(),
  user: z.looseObject({
    role: z.string().optional()
  }).optional()
});

const deletePayloadSchema = z.object({
  appUid: z.string().min(1),
  cause: z.enum(["Uninstall", "Suspend"])
});

const eventPayloadSchema = z.object({
  appUid: z.string().min(1),
  cause: z.enum(["PermissionsChanged"]),
  access: z.array(
    z.looseObject({
      access_token: z.string().min(1).optional(),
      permissions: z.unknown().optional()
    })
  ).optional()
});

type VendorRouteContext = {
  appId: string;
  accountId: string;
};

function isAppUidValid(appUid: string): boolean {
  return cfg().appUid === "" || appUid === cfg().appUid;
}

function getVendorRouteContext(req: Request): VendorRouteContext {
  return {
    appId: getStringRouteParam(req, "appId"),
    accountId: getStringRouteParam(req, "accountId")
  };
}

function loadInstalledAppOrReply204(res: Response, appId: string, accountId: string): AppInstance | null {
  const app = AppInstance.load(appId, accountId);

  if (!app.getStatusName()) {
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
    logMessage(
      "DEBUG",
      `Received: method=${req.method}, path=${req.path}`,
      { headers: redactSensitiveValue(req.headers) as Record<string, unknown> }
    );

    if (!authTokenIsValid(req.headers)) {
      sendUnauthorized(res);
      return;
    }

    next();
  });

  router.put(vendorEndpointAppRoutePath, (req: Request, res: Response) => {
    const { appId, accountId } = getVendorRouteContext(req);
    logMessage("DEBUG", "Vendor install request received", {
      appId,
      accountId,
      body: redactSensitiveValue(req.body) as Record<string, unknown>
    });

    const payload = installPayloadSchema.parse(req.body);

    if (!isAppUidValid(payload.appUid)) {
      sendBadRequest(res, "Invalid appUid");
      return;
    }

    const app = AppInstance.load(appId, accountId);

    app.accessToken = payload.access[0].access_token;

    if (!app.getStatusName()) {
      app.status = AppStatus.SETTINGS_REQUIRED;
    }

    app.persist();
    replyAppStatus(res, appId, accountId, app.getStatusName());
  });

  router.post(vendorEndpointButtonRoutePath, (req: Request, res: Response) => {
    const { appId, accountId } = getVendorRouteContext(req);
    logMessage("DEBUG", "Vendor button request received", {
      appId,
      accountId,
      body: redactSensitiveValue(req.body) as Record<string, unknown>
    });

    const payload = buttonPayloadSchema.parse(req.body);

    if (payload.objectId) {
      res.json(processDocumentButtonClick(payload.buttonName, payload.extensionPoint, payload.objectId, payload.user));
    } else if (payload.selected && payload.buttonName === "show-notification") {
      res.json(processListButtonClick(payload.buttonName, payload.extensionPoint, payload.selected));
    } else {
      res.json({});
    }
  });

  router.delete(vendorEndpointAppRoutePath, (req: Request, res: Response) => {
    const { appId, accountId } = getVendorRouteContext(req);
    logMessage("DEBUG", `Extracted: appId=${appId}, accountId=${accountId}`);

    const app = loadInstalledAppOrReply204(res, appId, accountId);
    if (!app) {
      return;
    }

    const payload = deletePayloadSchema.safeParse(req.body);
    if (!payload.success) {
      sendBadRequest(res, "Invalid delete request");
      return;
    }

    if (!isAppUidValid(payload.data.appUid)) {
      sendBadRequest(res, "Invalid appUid");
      return;
    }

    if (payload.data.cause === "Uninstall") {
      app.delete();
      logMessage("INFO", `App appId=${appId} deleted on accountId=${accountId}, cause=${payload.data.cause}`);
    } else {
      app.suspend();
      logMessage("INFO", `App appId=${appId} suspended on accountId=${accountId}, cause=${payload.data.cause}`);
    }

    res.status(200).end();
  });

  router.put(vendorEndpointEventRoutePath, (req: Request, res: Response) => {
    const { appId, accountId } = getVendorRouteContext(req);
    const app = loadInstalledAppOrReply204(res, appId, accountId);
    if (!app) {
      return;
    }

    const payload = eventPayloadSchema.safeParse(req.body);
    if (!payload.success) {
      sendBadRequest(res, "Invalid event request");
      return;
    }

    if (!isAppUidValid(payload.data.appUid)) {
      sendBadRequest(res, "Invalid appUid");
      return;
    }

    if (payload.data.cause === "PermissionsChanged") {
      const accessToken = payload.data.access?.[0]?.access_token;
      if (typeof accessToken === "string" && accessToken.length > 0) {
        app.accessToken = accessToken;
        app.persist();
      }

      logMessage("INFO", `Permissions changed for appId=${appId} on accountId=${accountId}`, {
        accessItems: Array.isArray(payload.data.access) ? payload.data.access.length : 0
      });
    }

    res.status(200).end();
  });

  return router;
}
