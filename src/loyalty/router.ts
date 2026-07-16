import { Router, type Request, type Response } from "express";
import { LoyaltyInstallation } from "../lib/domain/loyalty-installation";
import { LoyaltyCustomer } from "../lib/domain/loyalty-customer";
import type {
  LoyaltyApiCounterpartyDetailResponse,
  LoyaltyApiRetailDemandRecalcRequest,
  LoyaltyApiRetailDemandRequest,
  LoyaltyApiRetailSalesReturnRequest
} from "../lib/domain/types";
import { logMessage } from "../lib/observability/logger";
import {
  createRetailDemand,
  createRetailSalesReturn,
  LoyaltyRequestError,
  recalculateRetailDemand
} from "./bonus-service";

export function createLoyaltyRouter(): Router {
  const router = Router();

  router.post("/counterparty", (req: Request, res: Response) => {
    const installation = loadAuthorizedInstallationOrReply(req, res);
    if (!installation) return;
    const metadata = requiredCounterpartyMetadata(req.body);
    if (!metadata) {
      replyError(res, 412, "Не указаны обязательные метаданные покупателя", 999);
      return;
    }

    try {
      const customer = LoyaltyCustomer.find(installation.appId, installation.accountId, metadata.msId)
        ?? LoyaltyCustomer.create(installation.appId, installation.accountId, metadata.msId);
      customer.persist();
      res.status(201).end();
    } catch (error) {
      replyUnexpectedError(res, error);
    }
  });

  router.post("/counterparty/detail", (req: Request, res: Response) => {
    const installation = loadAuthorizedInstallationOrReply(req, res);
    if (!installation) return;
    const metadata = requiredCounterpartyMetadata(req.body);
    if (!metadata) {
      replyError(res, 412, "Не указаны обязательные метаданные покупателя", 999);
      return;
    }
    try {
      const customer = LoyaltyCustomer.find(installation.appId, installation.accountId, metadata.msId);
      if (!customer) {
        replyError(res, 404, "Покупатель не зарегистрирован в программе лояльности", 999);
        return;
      }
      const response: LoyaltyApiCounterpartyDetailResponse = {
        bonusProgram: { agentBonusBalance: customer.agentBonusBalance }
      };
      res.json(response);
    } catch (error) {
      replyUnexpectedError(res, error);
    }
  });

  router.post("/retaildemand/recalc", (req: Request, res: Response) => {
    const installation = loadAuthorizedInstallationOrReply(req, res);
    if (!installation) return;
    try {
      res.json(recalculateRetailDemand(
        installation.appId,
        installation.accountId,
        req.body as LoyaltyApiRetailDemandRecalcRequest
      ));
    } catch (error) {
      replyOperationError(res, error);
    }
  });

  router.post("/retaildemand", (req: Request, res: Response) => {
    const installation = loadAuthorizedInstallationOrReply(req, res);
    if (!installation) return;
    try {
      createRetailDemand(installation.appId, installation.accountId, req.body as LoyaltyApiRetailDemandRequest);
      res.status(201).end();
    } catch (error) {
      replyOperationError(res, error);
    }
  });

  router.post("/retailsalesreturn", (req: Request, res: Response) => {
    const installation = loadAuthorizedInstallationOrReply(req, res);
    if (!installation) return;
    try {
      createRetailSalesReturn(installation.appId, installation.accountId, req.body as LoyaltyApiRetailSalesReturnRequest);
      res.status(201).end();
    } catch (error) {
      replyOperationError(res, error);
    }
  });

  return router;
}

function loadAuthorizedInstallationOrReply(req: Request, res: Response): LoyaltyInstallation | null {
  try {
    const installation = LoyaltyInstallation.findByToken(
      req.header("Lognex-Discount-API-Auth-Token")?.trim() ?? ""
    );
    if (!installation) {
      replyError(res, 401, "Недействительный токен авторизации", 999);
      return null;
    }
    return installation;
  } catch (error) {
    replyUnexpectedError(res, error);
    return null;
  }
}

function requiredCounterpartyMetadata(body: unknown): { msId: string } | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const meta = raw.meta as Record<string, unknown> | undefined;
  const retailStore = raw.retailStore as Record<string, unknown> | undefined;
  const retailMeta = retailStore?.meta as Record<string, unknown> | undefined;
  if (typeof meta?.href !== "string" || !meta.href.trim()
    || typeof meta.id !== "string" || !meta.id.trim()
    || typeof retailMeta?.href !== "string" || !retailMeta.href.trim()
    || typeof retailMeta.id !== "string" || !retailMeta.id.trim()) {
    return null;
  }
  return { msId: meta.id.trim() };
}

function replyOperationError(res: Response, error: unknown): void {
  if (error instanceof LoyaltyRequestError) {
    replyError(res, error.status, error.message, 999, error.parameter);
    return;
  }
  replyUnexpectedError(res, error);
}

function replyUnexpectedError(res: Response, error: unknown): void {
  logMessage("ERROR", "LoyaltyAPI request failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  replyError(res, 500, "Не удалось обработать запрос программы лояльности", 999);
}

function replyError(res: Response, status: number, message: string, code: number, parameter?: string): void {
  res.status(status).json({
    errors: [{ error: message, ...(parameter ? { parameter } : {}), code, error_message: message }]
  });
}
