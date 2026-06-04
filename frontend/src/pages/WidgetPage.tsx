import { useEffect, useMemo, useState } from "react";
import WidgetSDK from "@moysklad/js-widget-sdk";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { diffState, formatDiffs, formatPayload, parseMaybeJson, type WidgetContext } from "../lib/sdk";

function resolveWidgetEntity(): WidgetContext["entity"] | null {
  if (window.location.pathname === "/entry/widget-customerorder") {
    return "customerorder";
  }

  if (window.location.pathname === "/entry/widget-invoiceout") {
    return "invoiceout";
  }

  return null;
}

export default function WidgetPage() {
  const [context, setContext] = useState<WidgetContext | null>(null);
  const [error, setError] = useState("");
  const [objectLabel, setObjectLabel] = useState("—");
  const [navigatePath, setNavigatePath] = useState("#customerorder?sort=o.moment%20d");
  const [dialogText, setDialogText] = useState("Hello from SDK");
  const [dialogButtons, setDialogButtons] = useState(
    '[{ "name": "Yes", "caption": "Да, удалить" },{ "name": "No", "caption": "Нет" }]'
  );
  const [validationPayload, setValidationPayload] = useState(
    '{ "name": "ValidationFeedback", "correlationId": 1, "messageId": 1, "valid": false, "message": "Нужно больше печенья" }'
  );
  const [updatePayload, setUpdatePayload] = useState('{ "name": "1" }');
  const [logs, setLogs] = useState<{ label: string; payload?: unknown }[]>([]);
  const [objectState, setObjectState] = useState<Record<string, unknown>>({});

  const sdk = useMemo(() => WidgetSDK.create({ debug: true }) as any, []);
  const { showSnackbar } = useSnackbar();
  const entity = resolveWidgetEntity();

  const log = (label: string, payload?: unknown) => {
    setLogs((prev) => [...prev, { label, payload }]);
  };

  useEffect(() => {
    if (!entity) {
      setError("Не удалось определить тип виджета");
      return;
    }

    let cancelled = false;

    fetch(`/utils/entry-context/widget?entity=${encodeURIComponent(entity)}`, { credentials: "same-origin" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || "Не удалось загрузить контекст виджета");
        }

        return payload as WidgetContext;
      })
      .then((payload) => {
        if (!cancelled) {
          setContext(payload);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          showSnackbar({
            message,
            variant: "error",
            autoHideDuration: 5000,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entity]);

  useEffect(() => {
    if (!context) {
      return;
    }

    const autoOpenFeedbackDelayMs = 1000;

    log("SDK initialized", { debug: true });
    sdk.onOpen((message: any) => {
      log("Event: Open", message);

      const resolvedId = message == null ? undefined : message.messageId;
      setTimeout(() => {
        log("auto openFeedback sent", sdk.openFeedback(resolvedId as any));
      }, autoOpenFeedbackDelayMs);

      if (!message || !message.objectId) {
        log("object fetch skipped", { reason: "missing objectId" });
        return;
      }

      fetch(context.getObjectUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contextNonce: context.contextNonce,
          objectId: message.objectId,
        }),
      })
        .then(async (response) => {
          const text = await response.text();

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${text}`);
          }

          return text;
        })
        .then((text) => {
          setObjectLabel(text);
        })
        .catch((fetchError: unknown) => {
          const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
          log("object fetch error", { message });
          showSnackbar({
            message,
            variant: "error",
            autoHideDuration: 5000,
          });
        });
    });
    sdk.onOpenPopup((message: unknown) => log("Event: OpenPopup", message));
    sdk.onChange((message: any) => {
      log("Event: Change", message);

      if (!message || !message.objectState) {
        log("Change ignored", { reason: "missing objectState" });
        return;
      }

      const nextState = message.objectState as Record<string, unknown>;
      log("Event: Change (diff)", formatDiffs(diffState(objectState, nextState)));
      setObjectState(nextState);
    });
    sdk.onSave((message: unknown) => log("Event: Save", message));
  }, [context, objectState, sdk]);

  if (error) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="eyebrow">Widget</div>
          <h1>Ошибка загрузки</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="eyebrow">Widget</div>
          <h1>Загрузка контекста</h1>
          <p>Подготавливаем React-версию widget.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell shell--popup">
      <section className="card">
        <div className="eyebrow">Widget</div>
        <h1>Текущий пользователь</h1>
        <p className="meta">
          {context.uid} ({context.fio})
        </p>

        <div className="divider" />
        <h2>Открытый объект</h2>
        <p className="meta">{objectLabel}</p>

        <div className="divider" />
        <h2>good-folder-selector</h2>
        <div className="row">
          <button
            className="button"
            type="button"
            onClick={async () => {
              try {
                log("selectGoodFolder response", await sdk.selectGoodFolder());
              } catch (eventError: unknown) {
                const message = eventError instanceof Error ? eventError.message : String(eventError);
                log("selectGoodFolder error", {
                  message,
                  name: eventError instanceof Error ? eventError.name : "Error",
                });
                showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
              }
            }}
          >
            Выбрать
          </button>
        </div>

        <div className="divider" />
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
              } catch (eventError: unknown) {
                const message = eventError instanceof Error ? eventError.message : String(eventError);
                log("navigateTo error", {
                  message,
                  name: eventError instanceof Error ? eventError.name : "Error",
                });
                showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
              }
            }}
          >
            Перейти
          </button>
        </div>

        <div className="divider" />
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
              } catch (eventError: unknown) {
                const message = eventError instanceof Error ? eventError.message : String(eventError);
                log("showDialog error", {
                  message,
                  name: eventError instanceof Error ? eventError.name : "Error",
                });
                showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
              }
            }}
          >
            Открыть
          </button>
        </div>

        <div className="divider" />
        <h2>dirty-state</h2>
        <div className="row row--actions">
          <button className="button" type="button" onClick={() => log("setDirty sent", sdk.setDirty())}>
            Установить
          </button>
          <button className="button button--secondary" type="button" onClick={() => log("clearDirty sent", sdk.clearDirty())}>
            Очистить
          </button>
        </div>

        <div className="divider" />
        <h2>validation-feedback</h2>
        <label className="field">
          <span>Параметры валидации (JSON или text)</span>
          <textarea value={validationPayload} onChange={(event) => setValidationPayload(event.target.value)} rows={6} />
        </label>
        <div className="row">
          <button
            className="button"
            type="button"
            onClick={() => {
              const payload = parseMaybeJson(validationPayload);
              const valid =
                payload && typeof payload === "object" && (payload as { valid?: unknown }).valid !== undefined
                  ? Boolean((payload as { valid?: unknown }).valid)
                  : false;
              const message =
                payload && typeof payload === "object" && (payload as { message?: unknown }).message !== undefined
                  ? String((payload as { message?: unknown }).message)
                  : undefined;
              const correlationId =
                payload && typeof payload === "object" && (payload as { correlationId?: unknown; changeMessageId?: unknown }).correlationId !== undefined
                  ? (payload as { correlationId?: unknown }).correlationId
                  : payload && typeof payload === "object" && (payload as { changeMessageId?: unknown }).changeMessageId !== undefined
                    ? (payload as { changeMessageId?: unknown }).changeMessageId
                    : undefined;

              log("validationFeedback sent", sdk.validationFeedback(valid, message, correlationId as any));
            }}
          >
            Подтвердить
          </button>
        </div>

        <div className="divider" />
        <h2>update-provider</h2>
        <label className="field">
          <span>Параметры обновления (JSON or text)</span>
          <textarea value={updatePayload} onChange={(event) => setUpdatePayload(event.target.value)} rows={4} />
        </label>
        <div className="row">
          <button
            className="button"
            type="button"
            onClick={async () => {
              try {
                log("update response", await sdk.update(parseMaybeJson(updatePayload) as any));
              } catch (eventError: unknown) {
                const message = eventError instanceof Error ? eventError.message : String(eventError);
                log("update error", { message });
                showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
              }
            }}
          >
            Обновить
          </button>
        </div>

        <div className="divider" />
        <h2>Popups</h2>
        <div className="row row--actions">
          <button
            className="button"
            type="button"
            onClick={async () => {
              try {
                log("showPopup response", await sdk.showPopup("some-popup", { foo: "bar" } as any));
              } catch (eventError: unknown) {
                const message = eventError instanceof Error ? eventError.message : String(eventError);
                log("showPopup error", { message });
                showSnackbar({ message, variant: "error", autoHideDuration: 5000 });
              }
            }}
          >
            Открыть
          </button>
          <button className="button button--secondary" type="button" onClick={() => log("closePopup sent", sdk.closePopup({ ok: true }))}>
            Закрыть
          </button>
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">Widget</div>
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
