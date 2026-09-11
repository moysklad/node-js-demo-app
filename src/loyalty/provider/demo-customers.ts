import type { LoyaltyApiCounterpartySearchResponse } from "../types";

type DemoCustomer = LoyaltyApiCounterpartySearchResponse["rows"][number];

/**
 * Демонстрационная база покупателей программы лояльности.
 * Реальное решение ищет покупателей в своем хранилище; здесь достаточно константы,
 * чтобы показать контракт внешнего поиска.
 *
 * ВНИМАНИЕ! Поля id и msId МойСклад разбирает как UUID, поэтому произвольные строки
 * в качестве идентификаторов использовать нельзя. msId заполняется только для покупателей,
 * которые уже заведены в МоемСкладе; в примере он не указан.
 */
export const demoCustomers: DemoCustomer[] = [
  {
    id: "7c3b1a52-2f4d-4f0a-9a6c-2c9f5f0b1d11",
    name: "Иванов Иван",
    discountCardNumber: "1000000000001",
    phone: "+79000000001",
    email: "ivanov@example.com",
    legalFirstName: "Иван",
    legalLastName: "Иванов",
    sex: "MALE"
  },
  {
    id: "8d4c2b63-3a5e-4b1b-8b7d-3daf6a1c2e22",
    name: "Петрова Мария",
    discountCardNumber: "1000000000002",
    phone: "+79000000002",
    email: "petrova@example.com",
    legalFirstName: "Мария",
    legalLastName: "Петрова",
    sex: "FEMALE"
  },
  {
    id: "9e5d3c74-4b6f-4c2c-9c8e-4ebf7b2d3f33",
    name: "Сидоров Петр",
    discountCardNumber: "1000000000003",
    phone: "+79000000003",
    email: "sidorov@example.com",
    legalFirstName: "Петр",
    legalLastName: "Сидоров",
    sex: "MALE"
  }
];

/**
 * Поиск покупателей по подстроке в имени, номере карты, телефоне или email.
 * Пустая строка поиска возвращает всех покупателей демо-базы.
 */
export function findDemoCustomers(search: string): DemoCustomer[] {
  const query = search.trim().toLowerCase();

  if (query === "") {
    return demoCustomers;
  }

  return demoCustomers.filter((customer) =>
    [customer.name, customer.discountCardNumber, customer.phone, customer.email]
      .some((field) => field?.toLowerCase().includes(query))
  );
}
