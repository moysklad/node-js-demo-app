/**
 * Типы Loyalty API (Discount API): контракт методов, которые МойСклад вызывает у провайдера,
 * и данные подключения, которые решение передает в МойСклад через Vendor API.
 */

export type VendorApiLoyaltyData = {
  url: string;
  token: string;
  externalSearch: boolean;
};

export type LoyaltyApiMeta = {
  href?: string;
  id?: string;
  idType?: "native" | "sync";
  type?: string;
};

export type LoyaltyApiCounterpartyRequest = {
  retailStore?: {
    meta?: LoyaltyApiMeta;
    name?: string;
  };
  meta?: LoyaltyApiMeta;
  name?: string;
  discountCardNumber?: string;
  phone?: string;
  email?: string;
  syncId?: string;
  legalFirstName?: string;
  legalMiddleName?: string;
  legalLastName?: string;
  birthDate?: string;
  sex?: "MALE" | "FEMALE";
  statusCheck?: "UNCHECKED" | "CHECKED" | "IGNORE";
};

export type LoyaltyApiCounterpartyDetailResponse = {
  bonusProgram: {
    agentBonusBalance: number;
  };
};

export type LoyaltyApiCounterpartySearchResponse = {
  rows: Array<{
    id: string;
    msId?: string;
    name: string;
    discountCardNumber?: string;
    phone?: string;
    email?: string;
    legalFirstName?: string;
    legalMiddleName?: string;
    legalLastName?: string;
    birthDate?: string;
    sex?: "MALE" | "FEMALE";
  }>;
};

export type LoyaltyApiAgent = {
  meta?: LoyaltyApiMeta;
  name?: string;
  discountCardNumber?: string;
  phone?: string;
  email?: string;
  legalFirstName?: string;
  legalMiddleName?: string;
  legalLastName?: string;
  birthDate?: string;
  sex?: "MALE" | "FEMALE";
};

export type LoyaltyApiPosition = {
  assortment?: {
    syncId?: string;
    meta?: LoyaltyApiMeta;
  };
  quantity?: number;
  price?: number;
  discountPercent?: number;
  discountedPrice?: number;
  sn?: Array<{ meta?: LoyaltyApiMeta; name?: string }>;
  pack?: { id?: string; name?: string; quantity?: number; barcode?: string };
};

export type LoyaltyApiRetailDemandRecalcRequest = {
  retailStore?: { meta?: LoyaltyApiMeta; name?: string };
  agent?: LoyaltyApiAgent;
  positions?: LoyaltyApiPosition[];
  bonusProgram?: { transactionType?: "EARNING" | "SPENDING" };
  preferredBonusToSpend?: number | null;
};

export type LoyaltyApiRetailDemandRecalcResponse = {
  agent: LoyaltyApiAgent;
  positions: LoyaltyApiPosition[];
  bonusProgram: {
    transactionType: "EARNING" | "SPENDING";
    agentBonusBalance: number;
    bonusValueToSpend: number;
    bonusValueToEarn: number;
    agentBonusBalanceAfter: number;
    paidByBonusPoints: number;
    receiptExtraInfo: string;
  };
  needVerification: false;
};

export type LoyaltyApiRetailDemandRequest = {
  retailStore?: { meta?: LoyaltyApiMeta; name?: string };
  name?: string;
  moment?: string;
  meta?: LoyaltyApiMeta;
  agent?: LoyaltyApiAgent;
  positions?: LoyaltyApiPosition[];
  bonusProgram?: { bonusValueToSpend?: number; bonusValueToEarn?: number };
  cashSum?: number;
  noCashSum?: number;
};

export type LoyaltyApiRetailSalesReturnRequest = {
  retailStore?: { meta?: LoyaltyApiMeta; name?: string };
  name?: string;
  moment?: string;
  meta?: LoyaltyApiMeta;
  demand?: { meta?: LoyaltyApiMeta };
  agent?: LoyaltyApiAgent & { href?: string; id?: string };
  positions?: LoyaltyApiPosition[];
  cashSum?: number;
  noCashSum?: number;
};

/** Состояние подключения для вкладки iframe. Тип чистый: его импортирует и сервер, и браузерный код. */
export type LoyaltyConnectionState = {
  state: "not-connected" | "connected" | "reconnect-required";
  /** Цвет бейджа статуса (Badge из кита): зеленый — подключено, оранжевый — нужны действия. */
  badge: "green" | "orange";
  title: string;
  details: string;
  externalSearch: boolean;
};
