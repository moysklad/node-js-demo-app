export type WidgetContext = {
  contextNonce: string;
  entity: "customerorder" | "invoiceout";
  fio: string;
  getObjectUrl: string;
  uid: string;
};

export type ParsedValidationFeedback = {
  valid: boolean;
  message?: string;
  changeMessageId?: number;
};
