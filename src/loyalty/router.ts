import { Router, type Request, type Response } from "express";
import { AppInstance } from "../lib/domain/app-instance";
import { LoyaltyAccount } from "../lib/domain/loyalty-account";
import { jsonApi } from "../lib/integrations/json-api";
import type {
  MoyskladCounterparty,
  MoyskladCounterpartyListResponse,
  MoyskladCounterpartyDetailResponse,
  MoyskladCounterpartyUpsertRequest
} from "../lib/domain/types";

export function createLoyaltyRouter(): Router {
  const router = Router();

  router.get("/counterparty", (req: Request, res: Response) => {
    const account = loadAuthorizedAccountOrReply(req, res);
    if (!account) {
      return;
    }

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const retailStoreId = typeof req.query.retailStoreId === "string" ? req.query.retailStoreId.trim() : "";
    if (!search || !retailStoreId) {
      replyError(res, 412, "Не указаны обязательные параметры поиска", 999, !search ? "search" : "retailStoreId");
      return;
    }

    const app = AppInstance.loadApp(account.accountId);
    if (!app.accessToken.trim()) {
      replyError(res, 502, "Не удалось получить access token приложения", 28002);
      return;
    }

    const response = jsonApi(app.accessToken).searchCounterparties(search);
    response
      .then((counterparties) => {
        const rows = filterCounterpartiesByRetailStore(counterparties, retailStoreId).map(mapCounterparty);
        res.json({ rows });
      })
      .catch(() => {
        replyError(res, 502, "Не удалось получить контрагентов из JSON API", 28003);
      });
  });

  const upsertCounterparty = async (req: Request, res: Response): Promise<void> => {
    const account = loadAuthorizedAccountOrReply(req, res);
    if (!account) {
      return;
    }

    const app = AppInstance.loadApp(account.accountId);
    if (!app.accessToken.trim()) {
      replyError(res, 502, "Не удалось получить access token приложения", 28002);
      return;
    }

    const payload = buildCounterpartyRequest(req.body);
    if (!payload) {
      replyError(res, 400, "Не указаны данные покупателя", 999);
      return;
    }

    try {
      const saved = await jsonApi(app.accessToken).upsertCounterparty(payload);
      if (!saved) {
        replyError(res, 502, "Не удалось сохранить контрагента в JSON API", 28004);
        return;
      }

      res.status(201).json(mapCounterparty(saved));
    } catch {
      replyError(res, 502, "Не удалось сохранить контрагента в JSON API", 28004);
    }
  };

  router.post("/counterparty", upsertCounterparty);
  router.post("/counterparty/detail", async (req: Request, res: Response) => {
    const account = loadAuthorizedAccountOrReply(req, res);
    if (!account) {
      return;
    }

    const payload = buildCounterpartyRequest(req.body, false);
    if (!payload) {
      replyError(res, 400, "Не указаны данные покупателя", 999);
      return;
    }

    if (!hasRequiredDetailFields(req.body)) {
      replyError(res, 400, "Не указаны обязательные поля покупателя", 999);
      return;
    }

    const response: MoyskladCounterpartyDetailResponse = {
      bonusProgram: {
        agentBonusBalance: calculateBonusBalance(payload)
      }
    };

    res.json(response);
  });

  return router;
}

function loadAuthorizedAccountOrReply(req: Request, res: Response): LoyaltyAccount | null {
  const account = LoyaltyAccount.findByToken(getAuthToken(req));
  if (!account) {
    replyError(res, 401, "Недействительный токен авторизации", 28001);
    return null;
  }

  return account;
}

function buildCounterpartyRequest(body: unknown, requireName = true): MoyskladCounterpartyUpsertRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const raw = body as Partial<MoyskladCounterpartyUpsertRequest> & Record<string, unknown>;
  const request: MoyskladCounterpartyUpsertRequest = {};

  if (typeof raw.name === "string" && raw.name.trim() !== "") {
    request.name = raw.name.trim();
  } else {
    const derivedName = buildDisplayName(raw.legalLastName, raw.legalFirstName, raw.legalMiddleName);
    if (derivedName) {
      request.name = derivedName;
    }
  }

  if (typeof raw.discountCardNumber === "string" && raw.discountCardNumber.trim() !== "") {
    request.discountCardNumber = raw.discountCardNumber.trim();
  }
  if (typeof raw.phone === "string" && raw.phone.trim() !== "") {
    request.phone = raw.phone.trim();
  }
  if (typeof raw.email === "string" && raw.email.trim() !== "") {
    request.email = raw.email.trim();
  }
  if (typeof raw.syncId === "string" && raw.syncId.trim() !== "") {
    request.syncId = raw.syncId.trim();
  }
  if (typeof raw.legalFirstName === "string" && raw.legalFirstName.trim() !== "") {
    request.legalFirstName = raw.legalFirstName.trim();
  }
  if (typeof raw.legalMiddleName === "string" && raw.legalMiddleName.trim() !== "") {
    request.legalMiddleName = raw.legalMiddleName.trim();
  }
  if (typeof raw.legalLastName === "string" && raw.legalLastName.trim() !== "") {
    request.legalLastName = raw.legalLastName.trim();
  }
  if (typeof raw.birthDate === "string" && raw.birthDate.trim() !== "") {
    request.birthDate = raw.birthDate.trim();
  }
  if (raw.sex === "MALE" || raw.sex === "FEMALE") {
    request.sex = raw.sex;
  }

  if (raw.retailStore && typeof raw.retailStore === "object") {
    const retailStore = raw.retailStore as Record<string, unknown>;
    const meta = retailStore.meta && typeof retailStore.meta === "object" ? (retailStore.meta as Record<string, unknown>) : null;
    request.retailStore = {
      ...(typeof retailStore.name === "string" && retailStore.name.trim() !== "" ? { name: retailStore.name.trim() } : {}),
      ...(meta
        ? {
            meta: {
              ...(typeof meta.href === "string" && meta.href.trim() !== "" ? { href: meta.href.trim() } : {}),
              ...(typeof meta.id === "string" && meta.id.trim() !== "" ? { id: meta.id.trim() } : {})
            }
          }
        : {})
    };
  }

  if (raw.meta && typeof raw.meta === "object") {
    const meta = raw.meta as Record<string, unknown>;
    request.meta = {
      ...(typeof meta.href === "string" && meta.href.trim() !== "" ? { href: meta.href.trim() } : {}),
      ...(typeof meta.id === "string" && meta.id.trim() !== "" ? { id: meta.id.trim() } : {})
    };
  }

  if (raw.statusCheck === "UNCHECKED" || raw.statusCheck === "CHECKED" || raw.statusCheck === "IGNORE") {
    request.statusCheck = raw.statusCheck;
  }

  return requireName ? (request.name ? request : null) : request;
}

function filterCounterpartiesByRetailStore(
  response: MoyskladCounterpartyListResponse | null,
  retailStoreId: string
): MoyskladCounterparty[] {
  const rows = Array.isArray(response?.rows) ? response.rows : [];
  return rows.filter((row) => {
    const rowStoreId = getCounterpartyRetailStoreId(row);
    return rowStoreId === "" || rowStoreId === retailStoreId;
  });
}

function mapCounterparty(counterparty: MoyskladCounterparty): Record<string, unknown> {
  return {
    id: counterparty.id ?? counterparty.meta?.id ?? "",
    msId: counterparty.msId ?? counterparty.meta?.id ?? null,
    name: counterparty.name ?? "",
    discountCardNumber: counterparty.discountCardNumber ?? "",
    phone: counterparty.phone ?? null,
    email: counterparty.email ?? null,
    legalFirstName: counterparty.legalFirstName ?? null,
    legalMiddleName: counterparty.legalMiddleName ?? null,
    legalLastName: counterparty.legalLastName ?? null,
    birthDate: counterparty.birthDate ?? null,
    sex: counterparty.sex ?? null
  };
}

function buildDisplayName(lastName?: string, firstName?: string, middleName?: string): string {
  return [lastName, firstName, middleName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function hasRequiredDetailFields(body: unknown): boolean {
  if (!body || typeof body !== "object") {
    return false;
  }

  const raw = body as Record<string, unknown>;
  const retailStore = raw.retailStore;
  const meta = raw.meta;

  if (!retailStore || typeof retailStore !== "object" || !meta || typeof meta !== "object") {
    return false;
  }

  const retailStoreMeta = (retailStore as Record<string, unknown>).meta;
  if (!retailStoreMeta || typeof retailStoreMeta !== "object") {
    return false;
  }

  const rawRetailStoreMeta = retailStoreMeta as Record<string, unknown>;
  const rawMeta = meta as Record<string, unknown>;

  return typeof rawRetailStoreMeta.href === "string" && rawRetailStoreMeta.href.trim() !== ""
    && typeof rawRetailStoreMeta.id === "string" && rawRetailStoreMeta.id.trim() !== ""
    && typeof rawMeta.href === "string" && rawMeta.href.trim() !== ""
    && typeof rawMeta.id === "string" && rawMeta.id.trim() !== "";
}

function calculateBonusBalance(counterparty: MoyskladCounterparty): number {
  void counterparty;
  return 500;
}

function getCounterpartyRetailStoreId(counterparty: MoyskladCounterparty): string {
  if (typeof counterparty.retailStoreId === "string" && counterparty.retailStoreId.trim() !== "") {
    return counterparty.retailStoreId;
  }

  const rawCounterparty = counterparty as Record<string, unknown>;
  const retailStore = rawCounterparty.retailStore;
  if (!retailStore || typeof retailStore !== "object") {
    return "";
  }

  const rawRetailStore = retailStore as Record<string, unknown>;
  const meta = rawRetailStore.meta;
  if (!meta || typeof meta !== "object") {
    return "";
  }

  const rawMeta = meta as Record<string, unknown>;
  return typeof rawMeta.id === "string" ? rawMeta.id : "";
}

function getAuthToken(req: Request): string {
  const value = req.header("Lognex-Discount-API-Auth-Token");
  return value?.trim() ?? "";
}

function replyError(
  res: Response,
  status: number,
  message: string,
  code: number,
  parameter?: string
): void {
  res.status(status).json({
    errors: [
      {
        error: message,
        ...(parameter ? { parameter } : {}),
        code,
        error_message: message
      }
    ]
  });
}
