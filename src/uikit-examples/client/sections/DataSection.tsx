import { useState } from "react";
import { Breadcrumbs } from "@moysklad/uikit/components/Breadcrumbs";
import { LabelValue } from "@moysklad/uikit/components/LabelValue";
import { Listing } from "@moysklad/uikit/components/Listing";
import { Tabs, type TabSelectedValue } from "@moysklad/uikit/components/Tabs";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { Section } from "../Section";

const SNIPPET = `
import { LabelValue } from "@moysklad/uikit/components/LabelValue";
import { Tabs } from "@moysklad/uikit/components/Tabs";

<LabelValue label="Покупатель" value="ООО «Ромашка»" />
<LabelValue label="Статус в сервисе" value="Отгружен" helpPopupContent="Статус приходит из сервиса раз в час" />

<Tabs value={tab} onChange={setTab}>
  <Tabs.Item value="orders">Заказы</Tabs.Item>
  <Tabs.Item value="products">Товары</Tabs.Item>
</Tabs>
`;

const ORDERS = ["№00121", "№00122", "№00123", "№00124"];

/** Карточка сущности и навигация: пары «поле — значение», вкладки, хлебные крошки, листание. */
export function DataSection() {
  const [tab, setTab] = useState<TabSelectedValue>("orders");
  const [orderIndex, setOrderIndex] = useState(2);

  return (
    <Section
      title="Карточка и навигация"
      description="LabelValue — поля карточки сущности в стиле МоегоСклада; Tabs — разделы внутри iframe; Breadcrumbs и Listing — навигация по спискам."
      file="DataSection.tsx"
      snippet={SNIPPET}
    >
      <VStack size="s16">
        <Breadcrumbs>
          <Breadcrumbs.Item>Интеграции</Breadcrumbs.Item>
          <Breadcrumbs.Item>Заказы</Breadcrumbs.Item>
          <Breadcrumbs.Item>{ORDERS[orderIndex]}</Breadcrumbs.Item>
        </Breadcrumbs>
        <Tabs value={tab} onChange={setTab} aria-label="Разделы карточки">
          <Tabs.Item value="orders">Заказ</Tabs.Item>
          <Tabs.Item value="products">Товары</Tabs.Item>
          <Tabs.Item value="history">История</Tabs.Item>
        </Tabs>
        {tab === "orders" && (
          <VStack size="s8">
            <LabelValue label="Номер в сервисе" value={ORDERS[orderIndex]} />
            <LabelValue label="Покупатель" value="ООО «Ромашка»" />
            <LabelValue label="Статус в сервисе" value="Отгружен" helpPopupContent="Статус приходит из сервиса раз в час" />
            <LabelValue label="Комментарий" value="" isEmpty />
          </VStack>
        )}
        {tab === "products" && <Text.Body>Позиции заказа: 3 товара на 12 480 ₽.</Text.Body>}
        {tab === "history" && <Text.Body>27.08.2026 10:15 — заказ выгружен в сервис.</Text.Body>}
        <Listing
          current={orderIndex + 1}
          total={ORDERS.length}
          isPrevDisabled={orderIndex === 0}
          isNextDisabled={orderIndex === ORDERS.length - 1}
          onPrev={() => setOrderIndex((index) => Math.max(0, index - 1))}
          onNext={() => setOrderIndex((index) => Math.min(ORDERS.length - 1, index + 1))}
        />
      </VStack>
    </Section>
  );
}
