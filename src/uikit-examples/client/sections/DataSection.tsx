import { useState } from "react";
import { Breadcrumbs } from "@moysklad/uikit/components/Breadcrumbs";
import { LabelValue } from "@moysklad/uikit/components/LabelValue";
import { LabelValueLink } from "@moysklad/uikit/components/LabelValueLink";
import { Listing } from "@moysklad/uikit/components/Listing";
import { Panel } from "@moysklad/uikit/components/Panel";
import { StatusBadge, StatusColor, type StatusBadgeOption } from "@moysklad/uikit/components/StatusBadge";
import { Tabs, type TabSelectedValue } from "@moysklad/uikit/components/Tabs";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { Section } from "../Section";

const SNIPPET = `
import { LabelValue } from "@moysklad/uikit/components/LabelValue";
import { Panel } from "@moysklad/uikit/components/Panel";
import { StatusBadge, StatusColor, type StatusBadgeOption } from "@moysklad/uikit/components/StatusBadge";
import { Tabs } from "@moysklad/uikit/components/Tabs";

const STATUSES: StatusBadgeOption<string>[] = [{ label: "Отгружен", value: "shipped", color: StatusColor.Green }];
<StatusBadge title={status.label} value={status} availableStatuses={STATUSES} onSelect={setStatus} />

<Panel columnsCount={2} items={[{ id: "buyer", width: 1, element: <LabelValue label="Покупатель" value="ООО «Ромашка»" /> }]} />

<Tabs value={tab} onChange={setTab}>
  <Tabs.Item value="orders">Заказы</Tabs.Item>
  <Tabs.Item value="products">Товары</Tabs.Item>
</Tabs>
`;

const ORDERS = ["№00121", "№00122", "№00123", "№00124"];

const STATUSES: StatusBadgeOption<string>[] = [
  { label: "Новый", value: "new", color: StatusColor.Blue },
  { label: "Отгружен", value: "shipped", color: StatusColor.Green },
  { label: "Отменен", value: "cancelled", color: StatusColor.Red }
];

/** Карточка сущности и навигация: пары «поле — значение», вкладки, хлебные крошки, листание. */
export function DataSection() {
  const [tab, setTab] = useState<TabSelectedValue>("orders");
  const [orderIndex, setOrderIndex] = useState(2);
  const [status, setStatus] = useState(STATUSES[1]);
  const [orderLink, setOrderLink] = useState("https://service.example/orders/00123");

  return (
    <Section
      title="Карточка и навигация"
      description="LabelValue и Panel — поля и сетка карточки сущности в стиле МоегоСклада; StatusBadge — статус со сменой; Tabs — разделы внутри iframe; Breadcrumbs и Listing — навигация по спискам."
      file="DataSection.tsx"
      snippet={SNIPPET}
    >
      <VStack size="s16">
        {/* Наведение у крошки появляется только вместе с onClick — некликабельная крошка выглядит как текст. */}
        <Breadcrumbs>
          <Breadcrumbs.Item onClick={() => setOrderIndex(0)}>Интеграции</Breadcrumbs.Item>
          <Breadcrumbs.Item onClick={() => setOrderIndex(0)}>Заказы</Breadcrumbs.Item>
          <Breadcrumbs.Item>{ORDERS[orderIndex]}</Breadcrumbs.Item>
        </Breadcrumbs>
        <Tabs value={tab} onChange={setTab} aria-label="Разделы карточки">
          <Tabs.Item value="orders">Заказ</Tabs.Item>
          <Tabs.Item value="products">Товары</Tabs.Item>
          <Tabs.Item value="history">История</Tabs.Item>
        </Tabs>
        {tab === "orders" && (
          <VStack size="s12">
            {/* StatusBadge — статус со сменой из дропдауна, цвета из палитры статусов МоегоСклада. */}
            <div>
              <StatusBadge title={status.label} value={status} availableStatuses={STATUSES} onSelect={setStatus} />
            </div>
            {/* Panel — сетка полей шапки документа; width задается в колонках сетки. */}
            <Panel
              columnsCount={2}
              items={[
                { id: "number", width: 1, element: <LabelValue label="Номер в сервисе" value={ORDERS[orderIndex]} /> },
                { id: "buyer", width: 1, element: <LabelValue label="Покупатель" value="ООО «Ромашка»" /> },
                {
                  id: "status",
                  width: 1,
                  element: <LabelValue label="Статус в сервисе" value={status.label} helpPopupContent="Статус приходит из сервиса раз в час" />
                },
                { id: "comment", width: 1, element: <LabelValue label="Комментарий" value="" isEmpty /> }
              ]}
            />
            {/* LabelValueLink — поле-ссылка с инлайн-редактированием. */}
            <LabelValueLink name="orderLink" label="Заказ в сервисе" value={orderLink} onChange={(e) => setOrderLink(e.target.value)} />
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
