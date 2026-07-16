import { LoyaltyBonusLedger, LoyaltyBonusLedgerError } from "../lib/domain/loyalty-bonus-ledger";
import { LoyaltyCustomer } from "../lib/domain/loyalty-customer";
import type {
  LoyaltyApiAgent,
  LoyaltyApiPosition,
  LoyaltyApiRetailDemandRecalcRequest,
  LoyaltyApiRetailDemandRecalcResponse,
  LoyaltyApiRetailDemandRequest,
  LoyaltyApiRetailSalesReturnRequest
} from "../lib/domain/types";
import { demoBonusPolicy } from "./demo-bonus-policy";

export class LoyaltyRequestError extends Error {
  constructor(message: string, public readonly status = 412, public readonly parameter?: string) {
    super(message);
  }
}

export function recalculateRetailDemand(
  appId: string,
  accountId: string,
  payload: LoyaltyApiRetailDemandRecalcRequest
): LoyaltyApiRetailDemandRecalcResponse {
  requireEntityMeta(payload.retailStore, "retailStore");
  const customer = requireCustomer(appId, accountId, payload.agent);
  const positions = requirePositions(payload.positions, false);
  const transactionType = payload.bonusProgram?.transactionType ?? "EARNING";
  if (transactionType !== "EARNING" && transactionType !== "SPENDING") {
    throw new LoyaltyRequestError("Некорректный тип бонусной операции", 412, "bonusProgram.transactionType");
  }

  const receiptTotal = calculateReceiptTotal(positions, false);
  const requestedSpend = optionalNonNegativeNumber(payload.preferredBonusToSpend, "preferredBonusToSpend");
  const availableBalance = Math.max(0, customer.agentBonusBalance);
  const desiredSpend = transactionType === "SPENDING"
    ? demoBonusPolicy.bonusToSpend(receiptTotal, availableBalance, requestedSpend)
    : 0;
  const discount = applyBonusDiscount(positions, receiptTotal, desiredSpend);
  const bonusValueToSpend = discount.bonusValueToSpend;
  const bonusValueToEarn = demoBonusPolicy.bonusToEarn(receiptTotal - bonusValueToSpend);

  return {
    agent: payload.agent as LoyaltyApiAgent,
    positions: discount.positions,
    bonusProgram: {
      transactionType,
      agentBonusBalance: customer.agentBonusBalance,
      bonusValueToSpend,
      bonusValueToEarn,
      agentBonusBalanceAfter: roundMoney(customer.agentBonusBalance - bonusValueToSpend + bonusValueToEarn),
      paidByBonusPoints: bonusValueToSpend,
      receiptExtraInfo: bonusValueToSpend > 0
        ? `Списано баллов: ${bonusValueToSpend}. Начислено баллов: ${bonusValueToEarn}.`
        : `Начислено баллов: ${bonusValueToEarn}.`
    },
    needVerification: false
  };
}

export function createRetailDemand(
  appId: string,
  accountId: string,
  payload: LoyaltyApiRetailDemandRequest
): void {
  const retailStoreId = requireEntityMeta(payload.retailStore, "retailStore");
  const documentId = requireMeta(payload.meta, "meta");
  const positions = requirePositions(payload.positions, true);
  const receiptTotal = calculateReceiptTotal(positions, false);
  const bonusSpent = optionalNonNegativeNumber(
    payload.bonusProgram?.bonusValueToSpend,
    "bonusProgram.bonusValueToSpend"
  ) ?? 0;
  const bonusEarned = optionalNonNegativeNumber(
    payload.bonusProgram?.bonusValueToEarn,
    "bonusProgram.bonusValueToEarn"
  ) ?? 0;
  if (bonusSpent > receiptTotal) {
    throw new LoyaltyRequestError("Сумма списания превышает сумму продажи", 412, "bonusProgram.bonusValueToSpend");
  }
  if (bonusSpent === 0 && bonusEarned === 0 && !payload.agent?.meta) {
    return;
  }
  const customer = requireCustomer(appId, accountId, payload.agent);

  try {
    LoyaltyBonusLedger.commitSale({
      appId,
      accountId,
      documentId,
      customerMsId: customer.msId,
      retailStoreId,
      receiptTotal,
      bonusSpent,
      bonusEarned
    });
  } catch (error) {
    throw mapLedgerError(error);
  }
}

export function createRetailSalesReturn(
  appId: string,
  accountId: string,
  payload: LoyaltyApiRetailSalesReturnRequest
): void {
  const retailStoreId = requireEntityMeta(payload.retailStore, "retailStore");
  const documentId = requireMeta(payload.meta, "meta");
  if (!payload.demand?.meta) {
    return;
  }
  const sourceSaleId = requireMeta(payload.demand.meta, "demand.meta");
  const positions = requirePositions(payload.positions, true);
  const customerMsId = readOptionalAgentId(payload.agent);

  try {
    LoyaltyBonusLedger.commitReturn({
      appId,
      accountId,
      documentId,
      sourceSaleId,
      ...(customerMsId ? { customerMsId } : {}),
      retailStoreId,
      receiptTotal: calculateReceiptTotal(positions, false)
    });
  } catch (error) {
    throw mapLedgerError(error);
  }
}

function requireCustomer(appId: string, accountId: string, agent: LoyaltyApiAgent | undefined): LoyaltyCustomer {
  const msId = requireEntityMeta(agent, "agent");
  const customer = LoyaltyCustomer.find(appId, accountId, msId);
  if (!customer) {
    throw new LoyaltyRequestError("Покупатель не зарегистрирован в программе лояльности", 404, "agent.meta.id");
  }
  return customer;
}

function readOptionalAgentId(agent: LoyaltyApiRetailSalesReturnRequest["agent"]): string | null {
  if (!agent || (!agent.meta && agent.href === undefined && agent.id === undefined)) {
    return null;
  }
  return agent.meta ? requireMeta(agent.meta, "agent.meta") : requireMeta(agent, "agent");
}

function requireEntityMeta(value: { meta?: unknown } | undefined, parameter: string): string {
  if (!value?.meta) {
    throw new LoyaltyRequestError("Не указаны обязательные метаданные", 412, `${parameter}.meta`);
  }
  return requireMeta(value.meta, `${parameter}.meta`);
}

function requireMeta(meta: unknown, parameter: string): string {
  if (!meta || typeof meta !== "object") {
    throw new LoyaltyRequestError("Не указаны обязательные метаданные", 412, parameter);
  }
  const raw = meta as Record<string, unknown>;
  if (typeof raw.href !== "string" || raw.href.trim() === "") {
    throw new LoyaltyRequestError("Не указан URL метаданных", 412, `${parameter}.href`);
  }
  if (typeof raw.id !== "string" || raw.id.trim() === "") {
    throw new LoyaltyRequestError("Не указан идентификатор метаданных", 412, `${parameter}.id`);
  }
  return raw.id.trim();
}

function requirePositions(positions: LoyaltyApiPosition[] | undefined, discounted: boolean): LoyaltyApiPosition[] {
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new LoyaltyRequestError("Не указаны позиции продажи", 412, "positions");
  }
  positions.forEach((position, index) => {
    requireEntityMeta(position.assortment, `positions[${index}].assortment`);
    if (!discounted) {
      const meta = position.assortment?.meta;
      if (meta?.idType !== "native" && meta?.idType !== "sync") {
        throw new LoyaltyRequestError(
          "Некорректный тип идентификатора товара",
          412,
          `positions[${index}].assortment.meta.idType`
        );
      }
      if (typeof meta.type !== "string" || !meta.type.trim()) {
        throw new LoyaltyRequestError("Не указан тип товара", 412, `positions[${index}].assortment.meta.type`);
      }
    }
    requireNonNegativeNumber(position.quantity, `positions[${index}].quantity`, false);
    requireNonNegativeNumber(position.price, `positions[${index}].price`);
    if (position.discountPercent !== undefined) {
      const value = requireNonNegativeNumber(position.discountPercent, `positions[${index}].discountPercent`);
      if (value > 100) {
        throw new LoyaltyRequestError("Процент скидки превышает 100", 412, `positions[${index}].discountPercent`);
      }
    }
    if (discounted && position.discountedPrice !== undefined) {
      requireNonNegativeNumber(position.discountedPrice, `positions[${index}].discountedPrice`);
    }
    if (position.sn && position.sn.length > 0 && position.sn.length !== position.quantity) {
      throw new LoyaltyRequestError(
        "Количество серийных номеров не совпадает с количеством товара",
        412,
        `positions[${index}].sn`
      );
    }
    position.sn?.forEach((serialNumber, serialIndex) => {
      requireEntityMeta(serialNumber, `positions[${index}].sn[${serialIndex}]`);
    });
    if (position.pack) {
      if (typeof position.pack.id !== "string" || !position.pack.id.trim()) {
        throw new LoyaltyRequestError("Не указан идентификатор упаковки", 412, `positions[${index}].pack.id`);
      }
      if (typeof position.pack.name !== "string" || !position.pack.name.trim()) {
        throw new LoyaltyRequestError("Не указано название упаковки", 412, `positions[${index}].pack.name`);
      }
      requireNonNegativeNumber(position.pack.quantity, `positions[${index}].pack.quantity`, false);
    }
  });
  return positions;
}

function calculateReceiptTotal(positions: LoyaltyApiPosition[], discounted: boolean): number {
  return roundMoney(positions.reduce((sum, position) => {
    const unitPrice = discounted ? discountedPrice(position) : position.price as number;
    return sum + unitPrice * (position.quantity as number);
  }, 0));
}

function discountedPrice(position: LoyaltyApiPosition): number {
  if (typeof position.discountedPrice === "number") {
    return position.discountedPrice;
  }
  return roundMoney((position.price as number) * (1 - (position.discountPercent ?? 0) / 100));
}

function applyBonusDiscount(
  positions: LoyaltyApiPosition[],
  receiptTotal: number,
  desiredSpend: number
): { positions: LoyaltyApiPosition[]; bonusValueToSpend: number } {
  let percent = receiptTotal === 0 ? 0 : desiredSpend >= receiptTotal
    ? 100
    : Math.floor(desiredSpend / receiptTotal * 10_000) / 100;
  let discounted = applyDiscountPercent(positions, percent);
  let actual = roundMoney(Math.max(0, receiptTotal - calculateReceiptTotal(discounted, true)));
  if (actual > desiredSpend && percent > 0) {
    percent = roundMoney(percent - 0.01);
    discounted = applyDiscountPercent(positions, percent);
    actual = roundMoney(Math.max(0, receiptTotal - calculateReceiptTotal(discounted, true)));
  }
  return { positions: discounted, bonusValueToSpend: actual };
}

function applyDiscountPercent(positions: LoyaltyApiPosition[], discountPercent: number): LoyaltyApiPosition[] {
  return positions.map((position) => ({
    ...position,
    discountPercent,
    discountedPrice: roundMoney((position.price as number) * (1 - discountPercent / 100))
  }));
}

function optionalNonNegativeNumber(value: unknown, parameter: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  return requireNonNegativeNumber(value, parameter);
}

function requireNonNegativeNumber(value: unknown, parameter: string, allowZero = true): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new LoyaltyRequestError("Ожидается неотрицательное число", 412, parameter);
  }
  return roundMoney(value);
}

function mapLedgerError(error: unknown): LoyaltyRequestError {
  if (!(error instanceof LoyaltyBonusLedgerError)) {
    throw error;
  }
  return new LoyaltyRequestError(
    error.message,
    error.kind === "CUSTOMER_NOT_FOUND" || error.kind === "SALE_NOT_FOUND" ? 404 : 412
  );
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
