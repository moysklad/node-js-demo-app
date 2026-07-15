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
  status: "Activating" | "SettingsRequired" | "Activated";
};

export type VendorApiLoyaltyData = {
  url: string;
  token: string;
  externalSearch: boolean;
};

export type VendorApiLoyaltyPatch = Partial<VendorApiLoyaltyData>;

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

export type MoyskladCounterpartyMeta = {
  href?: string;
  id?: string;
};

export type MoyskladCounterparty = {
  id?: string;
  msId?: string | null;
  name?: string;
  discountCardNumber?: string;
  phone?: string | null;
  email?: string | null;
  legalFirstName?: string | null;
  legalMiddleName?: string | null;
  legalLastName?: string | null;
  birthDate?: string | null;
  sex?: "MALE" | "FEMALE" | null;
  syncId?: string | null;
  retailStoreId?: string | null;
  meta?: MoyskladCounterpartyMeta;
};

export type MoyskladCounterpartyListResponse = {
  rows?: MoyskladCounterparty[];
};

export type MoyskladCounterpartyUpsertRequest = {
  retailStore?: {
    meta?: MoyskladCounterpartyMeta;
    name?: string;
  };
  meta?: MoyskladCounterpartyMeta;
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

export type MoyskladCounterpartyDetailResponse = {
  bonusProgram: {
    agentBonusBalance: number;
  };
};
