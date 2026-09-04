import { useEffect, useState } from "react";
import { Tabs, type TabSelectedValue } from "@moysklad/uikit/components/Tabs";
import { VStack } from "@moysklad/uikit/components/VStack";
import { LogPanel } from "../../ui/LogPanel";
import { useLog } from "../../ui/log";
import { sdk } from "../../ui/sdk";
import { ClosePopupSection, DialogSection, GoodFolderSection, NavigationSection } from "../../ui/sdk-actions";

/** Попап, который МойСклад открывает по showPopup() из виджета или iframe. Серверных данных у него нет. */
export function PopupPage() {
  const { entries, log } = useLog();
  const [tab, setTab] = useState<TabSelectedValue>("good-folder");

  useEffect(() => {
    log("SDK initialized", { debug: true });
    const unsubscribe = (["Open", "OpenPopup", "Change", "Save"] as const).map((name) =>
      sdk.on(name, (message) => log(`Event: ${name}`, message))
    );

    return () => unsubscribe.forEach((off) => off());
  }, [log]);

  return (
    <main className="page page--popup">
      <section className="card">
        <VStack size="s16">
          <Tabs value={tab} onChange={setTab} aria-label="Методы SDK">
            <Tabs.Item value="good-folder">Выбор группы товаров</Tabs.Item>
            <Tabs.Item value="navigation">Навигация</Tabs.Item>
            <Tabs.Item value="dialogs">Диалог</Tabs.Item>
            <Tabs.Item value="popups">Закрытие</Tabs.Item>
          </Tabs>
          {tab === "good-folder" && <GoodFolderSection log={log} />}
          {tab === "navigation" && <NavigationSection log={log} />}
          {tab === "dialogs" && <DialogSection log={log} />}
          {tab === "popups" && <ClosePopupSection log={log} />}
        </VStack>
      </section>
      <section className="card">
        <LogPanel entries={entries} />
      </section>
    </main>
  );
}
