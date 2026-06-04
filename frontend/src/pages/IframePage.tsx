import { useEffect, useMemo, useState } from "react";
import { Text } from "@moysklad/uikit/components/Text";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { VStack } from "@moysklad/uikit/components/VStack";
import { useWidgetSdk } from "../lib/use-widget-sdk";
import type { IframeContext, UpdateSettingsResponse } from "../lib/sdk";
import { applyUpdateSettingsResponse } from "../lib/iframe-settings";
import { IframeResizeProbe } from "./iframe/IframeResizeProbe";
import { IframeSettingsPanel } from "./iframe/IframeSettingsPanel";
import { IframeSummaryPanel } from "./iframe/IframeSummaryPanel";

type StoreOption = {
  label: string;
  value: string | number;
};

async function loadIframeContext(): Promise<IframeContext> {
  const response = await fetch("/utils/entry-context/iframe", { credentials: "same-origin" });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "Не удалось загрузить контекст iframe");
  }

  return payload as IframeContext;
}

export default function IframePage() {
  const [data, setData] = useState<IframeContext | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftStore, setDraftStore] = useState("");
  const [resizeProbeBlocks, setResizeProbeBlocks] = useState(1);
  const sdk = useWidgetSdk(true);
  const { showSnackbar } = useSnackbar();
  const storeOptions = useMemo<StoreOption[]>(() => {
    const values = data?.storesValues ?? [];

    return values.map((value) => ({
      label: value,
      value
    }));
  }, [data?.storesValues]);

  useEffect(() => {
    let cancelled = false;

    loadIframeContext()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setData(payload);
        setDraftMessage(payload.infoMessage);
        setDraftStore(payload.store);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stopAutoResize = sdk.autoResizeIframe();

    return () => {
      stopAutoResize();
      sdk.destroy?.();
    };
  }, [sdk]);

  const saveSettings = async () => {
    if (!data) {
      return;
    }

    setSubmitting(true);

    try {
      const params = new URLSearchParams({
        infoMessage: draftMessage,
        store: draftStore,
        contextNonce: data.contextNonce,
      });

      const response = await fetch("/utils/update-settings", {
        method: "POST",
        body: params,
        credentials: "same-origin",
      });

      const payload = (await response.json().catch(() => null)) as UpdateSettingsResponse | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Не удалось сохранить настройки");
      }

      const successMessage = payload?.message || "Настройки обновлены";
      const nextState = applyUpdateSettingsResponse(data, payload, draftMessage, draftStore);

      setData(nextState.nextData);
      setDraftMessage(nextState.nextDraftMessage);
      setDraftStore(nextState.nextDraftStore);
      showSnackbar({
        message: successMessage,
        autoHideDuration: 3000,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      showSnackbar({
        message: errorMessage,
        autoHideDuration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <main className="shell">
        <VStack size="s4">
          <Text.Body>Ошибка загрузки</Text.Body>
          <Text.Body>{error}</Text.Body>
        </VStack>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell">
        <Text.Body>Загрузка...</Text.Body>
      </main>
    );
  }

  return (
    <main className="shell shell--iframe">
      <IframeSummaryPanel data={data} />
      <IframeSettingsPanel
        data={data}
        draftMessage={draftMessage}
        draftStore={draftStore}
        submitting={submitting}
        storeOptions={storeOptions}
        onDraftMessageChange={setDraftMessage}
        onDraftStoreChange={setDraftStore}
        onSave={saveSettings}
      />
      <IframeResizeProbe
        blocks={resizeProbeBlocks}
        onDecrease={() => setResizeProbeBlocks((current) => Math.max(1, current - 1))}
        onIncrease={() => setResizeProbeBlocks((current) => current + 1)}
      />
    </main>
  );
}
