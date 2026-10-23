import { Router, type NextFunction, type Request, type Response } from "express";
import { LoyaltyInstallation } from "../domain/loyalty-installation";
import { findDemoCustomers } from "./demo-customers";
import type {
  LoyaltyApiCounterpartyDetailResponse,
  LoyaltyApiCounterpartySearchResponse,
  LoyaltyApiRetailDemandRecalcRequest,
  LoyaltyApiRetailDemandRecalcResponse
} from "../types";
import { getStringQueryParam } from "../../lib/http/http-values";
import { logMessage } from "../../lib/observability/logger";

export function createLoyaltyProviderRouter(): Router {
  const router = Router();

  router.use(authorizeLoyaltyRequest);

  router.post("/counterparty", (_req: Request, res: Response) => {
    res.status(201).end();
  });

  // Внешний поиск покупателей. Метод обязателен только при externalSearch: true,
  // поэтому при выключенном режиме решение отвечает 404, как и на другие нереализованные методы.
  // Пока переподключение не подтверждено, режим берется из действующих или ожидающих настроек.
  router.get("/counterparty", (req: Request, res: Response) => {
    const installation = getInstallationFromLocals(res);

    if (!installation?.allowsExternalSearch()) {
      replyError(res, 404, "Внешний поиск покупателей не используется: externalSearch выключен", 999);
      return;
    }

    const search = getStringQueryParam(req, "search");
    const retailStoreId = getStringQueryParam(req, "retailStoreId");
    logMessage("DEBUG", "Loyalty API external customer search", { retailStoreId });

    const response: LoyaltyApiCounterpartySearchResponse = { rows: findDemoCustomers(search) };
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

// Провайдер принимает действующий и ожидающий токены: после переподключения с неизвестным исходом
// решение не знает, каким из них пользуется МойСклад.
function authorizeLoyaltyRequest(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.header("Lognex-Discount-API-Auth-Token")?.trim() ?? "";
    const installation = LoyaltyInstallation.findByToken(token);
    if (!installation?.acceptsToken(token)) {
      replyError(res, 401, "Недействительный токен авторизации", 999);
      return;
    }

    res.locals.loyaltyInstallation = installation;
    next();
  } catch (error) {
    logMessage("ERROR", "Loyalty API authorization failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    replyError(res, 500, "Не удалось авторизовать запрос программы лояльности", 999);
  }
}

function getInstallationFromLocals(res: Response): LoyaltyInstallation | null {
  const installation = res.locals.loyaltyInstallation;

  return installation instanceof LoyaltyInstallation ? installation : null;
}

function replyError(res: Response, status: number, message: string, code: number): void {
  res.status(status).json({
    errors: [{ error: message, code, error_message: message }]
  });
}
