export type LoyaltySaleInput = {
  appId: string;
  accountId: string;
  documentId: string;
  customerMsId: string;
  retailStoreId: string;
  receiptTotal: number;
  bonusSpent: number;
  bonusEarned: number;
};

export type LoyaltyReturnInput = {
  appId: string;
  accountId: string;
  documentId: string;
  sourceSaleId: string;
  customerMsId?: string;
  retailStoreId: string;
  receiptTotal: number;
};

export interface LoyaltyBonusLedgerRepository {
  commitSale(input: LoyaltySaleInput): void;
  commitReturn(input: LoyaltyReturnInput): void;
}

export class LoyaltyBonusLedger {
  private static repository: LoyaltyBonusLedgerRepository | null = null;

  static configureRepository(repository: LoyaltyBonusLedgerRepository): void {
    LoyaltyBonusLedger.repository = repository;
  }

  static commitSale(input: LoyaltySaleInput): void {
    LoyaltyBonusLedger.getRepository().commitSale(input);
  }

  static commitReturn(input: LoyaltyReturnInput): void {
    LoyaltyBonusLedger.getRepository().commitReturn(input);
  }

  private static getRepository(): LoyaltyBonusLedgerRepository {
    if (!LoyaltyBonusLedger.repository) {
      throw new Error("Loyalty bonus ledger repository is not configured");
    }
    return LoyaltyBonusLedger.repository;
  }
}

export class LoyaltyBonusLedgerError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "CUSTOMER_NOT_FOUND"
      | "SALE_NOT_FOUND"
      | "INSUFFICIENT_BALANCE"
      | "INVALID_RETURN"
      | "DOCUMENT_CONFLICT"
  ) {
    super(message);
  }
}
