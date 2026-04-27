import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AppInstance, AppStatus } from "../lib/app-instance";
import { logMessage } from "../lib/logger";
import { redactSensitiveValue } from "../lib/security";
import { authTokenIsValid } from "../lib/vendor-api";
import { allButtonNames, processDocumentButtonClick, processListButtonClick } from "./button";

const vendorEndpointAppRoutePath = "/api/moysklad/vendor/1.0/apps/:appId/:accountId";
const vendorEndpointButtonRoutePath = `${vendorEndpointAppRoutePath}/button`;

const installPayloadSchema = z.object({
  appUid: z.string().min(1).max(255),
  access: z.array(
    z.object({
      access_token: z.string().min(1).max(4096)
    })
  ).min(1)
});

const buttonPayloadSchema = z.object({
  buttonName: z.enum(allButtonNames),
  extensionPoint: z.string().min(1).max(255),
  objectId: z.string().min(1).max(255).optional(),
  selected: z.array(z.object({ id: z.string().min(1).max(255) })).max(200).optional(),
  user: z.object({
    role: z.string().max(255).optional()
  }).passthrough().optional()
});

function getRouteParam(req: Request, key: "appId" | "accountId"): string {
  const value = req.params[key];

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return "";
}

function ensureInstalledAppStatus(
  res: Response,
  appId: string,
  accountId: string,
  status: string | null
): boolean {
  if (status) {
    return true;
  }

  logMessage("INFO", `App appId=${appId} not installed on accountId=${accountId}`);
  res.status(204).end();
  return false;
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
      res.status(401).end();
      return;
    }

    next();
  });

  router.put(vendorEndpointAppRoutePath, (req: Request, res: Response) => {
    const appId = getRouteParam(req, "appId");
    const accountId = getRouteParam(req, "accountId");
    logMessage("DEBUG", `Extracted: appId=${appId}, accountId=${accountId}`);
    logMessage("DEBUG", "Request body received", { body: redactSensitiveValue(req.body) as Record<string, unknown> });

    const payload = installPayloadSchema.parse(req.body);
    const app = AppInstance.load(appId, accountId);

    app.accessToken = payload.access[0].access_token;

    if (!app.getStatusName()) {
      app.status = AppStatus.SETTINGS_REQUIRED;
    }

    app.persist();
    replyAppStatus(res, appId, accountId, app.getStatusName());
  });

  router.post(vendorEndpointAppRoutePath, (_req: Request, res: Response) => {
    res.status(200).end();
  });

  router.post(vendorEndpointButtonRoutePath, (req: Request, res: Response) => {
    const appId = getRouteParam(req, "appId");
    const accountId = getRouteParam(req, "accountId");
    logMessage("DEBUG", `Extracted: appId=${appId}, accountId=${accountId}`);
    logMessage("DEBUG", "Request body received", { body: redactSensitiveValue(req.body) as Record<string, unknown> });

    const payload = buttonPayloadSchema.parse(req.body);

    if (payload.objectId) {
      res.json(processDocumentButtonClick(payload.buttonName, payload.extensionPoint, payload.objectId, payload.user));
    } else if (payload.selected && payload.buttonName === "show-notification") {
      res.json(processListButtonClick(payload.buttonName, payload.extensionPoint, payload.selected));
    } else {
      res.json({});
    }

    logMessage(
      "INFO",
      `Button processed for appId=${appId} on accountId=${accountId} by user=${JSON.stringify(payload.user)}`
    );
  });

  router.get(vendorEndpointAppRoutePath, (req: Request, res: Response) => {
    const appId = getRouteParam(req, "appId");
    const accountId = getRouteParam(req, "accountId");
    logMessage("DEBUG", `Extracted: appId=${appId}, accountId=${accountId}`);

    const app = AppInstance.load(appId, accountId);

    if (!ensureInstalledAppStatus(res, appId, accountId, app.getStatusName())) {
      return;
    }

    replyAppStatus(res, appId, accountId, app.getStatusName());
  });

  router.delete(vendorEndpointAppRoutePath, (req: Request, res: Response) => {
    const appId = getRouteParam(req, "appId");
    const accountId = getRouteParam(req, "accountId");
    logMessage("DEBUG", `Extracted: appId=${appId}, accountId=${accountId}`);

    const app = AppInstance.load(appId, accountId);

    if (!ensureInstalledAppStatus(res, appId, accountId, app.getStatusName())) {
      return;
    }

    app.delete();
    logMessage("INFO", `App appId=${appId} deleted on accountId=${accountId}`);
    res.status(204).end();
  });

  return router;
}
