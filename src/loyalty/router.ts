import { Router, type NextFunction, type Request, type Response } from "express";
import { LoyaltyInstallation } from "../lib/domain/loyalty-installation";
import type {
  LoyaltyApiCounterpartyDetailResponse,
  LoyaltyApiCounterpartySearchResponse,
  LoyaltyApiRetailDemandRecalcRequest,
  LoyaltyApiRetailDemandRecalcResponse
} from "../lib/domain/types";
import { logMessage } from "../lib/observability/logger";

export function createLoyaltyRouter(): Router {
  const router = Router();

  router.use(authorizeLoyaltyRequest);

  router.post("/counterparty", (_req: Request, res: Response) => {
    res.status(201).end();
  });

  router.get("/counterparty", (_req: Request, res: Response) => {
    const response: LoyaltyApiCounterpartySearchResponse = { rows: [] };
    res.json(response);
  });

  router.post("/counterparty/detail", (_req: Request, res: Response) => {
    const response: LoyaltyApiCounterpartyDetailResponse = {
      bonusProgram: { agentBonusBalance: 0 }
    };
    res.json(response);
  });

  router.post("/retaildemand/recalc", (req: Request, res: Response) => {
    const request = req.body as LoyaltyApiRetailDemandRecalcRequest;
    const transactionType = request.bonusProgram?.transactionType === "SPENDING" ? "SPENDING" : "EARNING";
    const positions = (request.positions ?? []).map((position) => ({
      ...position,
      discountPercent: 0,
      discountedPrice: position.price ?? 0
    }));
    const response: LoyaltyApiRetailDemandRecalcResponse = {
      agent: request.agent ?? {},
      positions,
      bonusProgram: {
        transactionType,
        agentBonusBalance: 0,
        bonusValueToSpend: 0,
        bonusValueToEarn: 0,
        agentBonusBalanceAfter: 0,
        paidByBonusPoints: 0,
        receiptExtraInfo: ""
      },
      needVerification: false
    };
    res.json(response);
  });

  router.post("/retaildemand", (_req: Request, res: Response) => {
    res.status(201).end();
  });

  router.post("/retailsalesreturn", (_req: Request, res: Response) => {
    res.status(201).end();
  });

  return router;
}

function authorizeLoyaltyRequest(req: Request, res: Response, next: NextFunction): void {
  try {
    const installation = LoyaltyInstallation.findByToken(
      req.header("Lognex-Discount-API-Auth-Token")?.trim() ?? ""
    );
    if (!installation) {
      replyError(res, 401, "Недействительный токен авторизации", 999);
      return;
    }
    next();
  } catch (error) {
    logMessage("ERROR", "Loyalty API authorization failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    replyError(res, 500, "Не удалось авторизовать запрос программы лояльности", 999);
  }
}

function replyError(res: Response, status: number, message: string, code: number): void {
  res.status(status).json({
    errors: [{ error: message, code, error_message: message }]
  });
}
