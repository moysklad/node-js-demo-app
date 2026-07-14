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
