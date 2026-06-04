import { useEffect, useMemo, useState } from "react";
import WidgetSDK from "@moysklad/js-widget-sdk";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { formatPayload, parseMaybeJson } from "../lib/sdk";

export default function PopupPage() {
  const [activeTab, setActiveTab] = useState("good-folder");
  const [navigatePath, setNavigatePath] = useState("#customerorder?sort=o.moment%20d");
  const [dialogText, setDialogText] = useState("Hello from SDK");
  const [dialogButtons, setDialogButtons] = useState(
    '[{ "name": "Yes", "caption": "Да, удалить" },{ "name": "No", "caption": "Нет" }]'
  );
  const [popupName, setPopupName] = useState("some-popup");
  const [popupParams, setPopupParams] = useState('{ "foo": "bar" }');
  const [logs, setLogs] = useState<{ label: string; payload?: unknown }[]>([]);

  const sdk = useMemo(() => WidgetSDK.create({ debug: true }) as any, []);
  const { showSnackbar } = useSnackbar();

  const log = (label: string, payload?: unknown) => {
    setLogs((prev) => [...prev, { label, payload }]);
  };

  useEffect(() => {
    log("SDK initialized", { debug: true });
    sdk.autoResizeIframe();
    sdk.onOpen((message: unknown) => log("Event: Open", message));
    sdk.onOpenPopup((message: unknown) => log("Event: OpenPopup", message));
  }, [sdk]);

  const tabs = [
    { id: "good-folder", title: "Выбор группы товаров" },
    { id: "navigation", title: "Навигация" },
    { id: "dialogs", title: "Диалог" },
    { id: "popups", title: "Попап" },
  ];

  return (
    <main className="shell shell--popup">
      <section className="card">
        <div className="tabs" role="tablist" aria-label="SDK sections">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                className={`tab${isActive ? " active" : ""}`}
                role="tab"
                aria-selected={isActive ? "true" : "false"}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.title}
              </button>
            );
          })}
        </div>

        {activeTab === "good-folder" ? (
          <section className="tab-panel active">
            <h2>good-folder-selector</h2>
            <div className="row">
              <button
                className="button"
                type="button"
                onClick={async () => {
                  try {
                    log("selectGoodFolder response", await sdk.selectGoodFolder());
                  } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    log("selectGoodFolder error", {
                      message,
                      name: error instanceof Error ? error.name : "Error",
                    });
                    showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
                  }
                }}
              >
                Выбрать
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "navigation" ? (
          <section className="tab-panel active">
            <h2>navigation-service</h2>
            <label className="field">
              <span>Путь</span>
              <input value={navigatePath} onChange={(event) => setNavigatePath(event.target.value)} />
            </label>
            <div className="row">
              <button
                className="button"
                type="button"
                onClick={async () => {
                  try {
                    log("navigateTo response", await sdk.navigateTo(navigatePath.trim() || "/", "blank"));
                  } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    log("navigateTo error", {
                      message,
                      name: error instanceof Error ? error.name : "Error",
                    });
                    showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
                  }
                }}
              >
                Перейти
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "dialogs" ? (
          <section className="tab-panel active">
            <h2>standard-dialogs</h2>
            <label className="field">
              <span>Текст диалога</span>
              <input value={dialogText} onChange={(event) => setDialogText(event.target.value)} />
            </label>
            <label className="field">
              <span>Кнопки диалога (JSON)</span>
              <textarea value={dialogButtons} onChange={(event) => setDialogButtons(event.target.value)} rows={6} />
            </label>
            <div className="row">
              <button
                className="button"
                type="button"
                onClick={async () => {
                  try {
                    const buttonsPayload = parseMaybeJson(dialogButtons);
                    const normalizedButtons = Array.isArray(buttonsPayload)
                      ? buttonsPayload
                      : buttonsPayload && Array.isArray((buttonsPayload as { buttons?: unknown }).buttons)
                        ? (buttonsPayload as { buttons: unknown[] }).buttons
                        : undefined;

                    log("showDialog response", await sdk.showDialog(dialogText.trim() || "Dialog", normalizedButtons as any));
                  } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    log("showDialog error", {
                      message,
                      name: error instanceof Error ? error.name : "Error",
                    });
                    showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
                  }
                }}
              >
                Открыть
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "popups" ? (
          <section className="tab-panel active">
            <h2>Popups</h2>
            <label className="field">
              <span>Название попапа</span>
              <input value={popupName} onChange={(event) => setPopupName(event.target.value)} />
            </label>
            <label className="field">
              <span>Параметры попапа (JSON)</span>
              <textarea value={popupParams} onChange={(event) => setPopupParams(event.target.value)} rows={6} />
            </label>
            <div className="row row--actions">
              <button
                className="button"
                type="button"
                onClick={async () => {
                  try {
                    log("showPopup response", await sdk.showPopup(popupName.trim() || "popup", parseMaybeJson(popupParams) as any));
                  } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    log("showPopup error", {
                      message,
                    });
                    showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
                  }
                }}
              >
                Открыть
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  log("closePopup sent", sdk.closePopup({ ok: true }));
                }}
              >
                Закрыть
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <section className="card">
        <div className="eyebrow">Popup</div>
        <h1>Логи SDK</h1>
        <div className="log-list">
          {logs.map((entry, index) => (
            <article className="log-entry" key={`${entry.label}-${index}`}>
              <strong>{entry.label}</strong>
              {entry.payload !== undefined ? <pre>{formatPayload(entry.payload)}</pre> : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
