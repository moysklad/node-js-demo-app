export const entitiesMap = {
  customerorder: "Заказ покупателя",
  invoiceout: "Счет покупателю",
} as const;

export type SupportedEntity = keyof typeof entitiesMap;

export function isSupportedEntity(entity: string): entity is SupportedEntity {
  return entity in entitiesMap;
}
