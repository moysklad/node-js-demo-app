export type VendorApiContextResponse = {
  uid: string;
  shortFio?: string;
  accountId: string;
  permissions?: {
    admin?: {
      view?: string;
    };
  };
};

export type VendorApiStatusResponse = {
  status: "SettingsRequired" | "Activated";
};

export type VendorApiLoyaltyData = {
  url: string;
  token: string;
  externalSearch: boolean;
};

export type MoyskladStore = {
  id?: string;
  name?: string;
};

export type MoyskladStoreListResponse = {
  rows?: MoyskladStore[];
};

export type MoyskladEntityObject = {
  id?: string;
  name?: string;
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
