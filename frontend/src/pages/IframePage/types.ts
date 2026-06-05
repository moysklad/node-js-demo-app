export type IframeContext = {
  accountId: string;
  appVersion: string;
  contextNonce: string;
  fio: string;
  infoMessage: string;
  isAdmin: boolean;
  isSettingsRequired: boolean;
  store: string;
  storesValues: string[];
  uid: string;
};

export type UpdateSettingsResponse = {
  message: string;
  status: {
    className: string;
    title: string;
    showDetails: boolean;
    infoMessage: string;
    store: string;
  };
};
