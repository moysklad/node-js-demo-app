import { useState } from "react";
import { Tabs, type TabSelectedValue } from "@moysklad/uikit/components/Tabs";
// [feature:loyalty] программа лояльности: вкладка живет в модуле src/loyalty.
import { LoyaltyTab } from "../../../../loyalty/iframe/client/LoyaltyTab";
// [feature:uikit-examples] примеры UI Kit: вкладка живет в модуле src/uikit-examples.
import { ExamplesTab } from "../../../../uikit-examples/client/ExamplesTab";
import type { IframePageData } from "../page-data";
import { ResizeProbe } from "./ResizeProbe";
import { SettingsForm } from "./SettingsForm";
import { StatusCard } from "./StatusCard";
import { UserInfo } from "./UserInfo";

/**
 * Основной iframe решения. У решения одна такая страница, поэтому разделы —
 * это вкладки внутри нее; модули добавляют свои вкладки в помеченных местах.
 * Минимальный iframe — только ветка tab === "main": вкладки и импорты со швами
 * [feature:…] можно удалить целиком.
 */
export function IframePage({ data }: { data: IframePageData }) {
  const [tab, setTab] = useState<TabSelectedValue>("main");
  const [status, setStatus] = useState(data.status);

  return (
    <>
      <Tabs className="page-tabs" value={tab} onChange={setTab} aria-label="Разделы решения">
        <Tabs.Item value="main">Основное</Tabs.Item>
        {/* [feature:loyalty] программа лояльности */}
        <Tabs.Item value="loyalty">Программа лояльности</Tabs.Item>
        {/* [feature:uikit-examples] примеры UI Kit */}
        <Tabs.Item value="uikit">Примеры UI Kit</Tabs.Item>
      </Tabs>

      {tab === "main" && (
        <main className="page">
          <section className="card">
            <UserInfo data={data} />
            <StatusCard appVersion={data.appVersion} status={status} />
          </section>
          <section className="card">
            <SettingsForm data={data} onStatusChange={setStatus} />
          </section>
          <section className="card page__wide">
            <ResizeProbe />
          </section>
        </main>
      )}

      {/* [feature:loyalty] программа лояльности */}
      {tab === "loyalty" && (
        <LoyaltyTab
          isAdmin={data.isAdmin}
          contextNonce={data.contextNonce}
          loyalty={data.loyalty}
          defaultLoyaltyProviderUrl={data.defaultLoyaltyProviderUrl}
        />
      )}

      {/* [feature:uikit-examples] примеры UI Kit */}
      {tab === "uikit" && <ExamplesTab />}
    </>
  );
}
