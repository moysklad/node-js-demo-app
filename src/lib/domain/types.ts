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

export type UserContextRole = "admin" | "cashier" | "worker" | "individual";

export type VendorApiUserContext = {
  accountId: string;
  userId: string;
  userUid: string;
  role: UserContextRole;
};

export type UserContextExchangeResult =
  | { ok: true; data: VendorApiUserContext }
  | { ok: false; status: number; errorCode: string | null };

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
