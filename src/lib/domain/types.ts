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

export type VendorApiUserContext = {
  accountId: string;
  userId: string;
  userUid: string;
};

export type UserContextExchangeResult<T> =
  | { ok: true; data: T }
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
