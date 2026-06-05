import { useEffect, useMemo, useState } from "react";
import { applyUpdateSettingsResponse } from "../lib/apply-update-settings-response";
import type { IframeContext, UpdateSettingsResponse } from "../types";

type SnackbarFn = (message: string, autoHideDuration: number) => void;

type StoreOption = {
  label: string;
  value: string | number;
};

export function useIframeSettings(
  data: IframeContext | null,
  setData: (value: IframeContext) => void,
  showSnackbar: SnackbarFn
) {
  const [submitting, setSubmitting] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftStore, setDraftStore] = useState("");

  useEffect(() => {
    if (!data) {
      return;
    }

    setDraftMessage(data.infoMessage);
    setDraftStore(data.store);
  }, [data]);

  const storeOptions = useMemo<StoreOption[]>(() => {
    const values = data?.storesValues ?? [];

    return values.map((value) => ({
      label: value,
      value,
    }));
  }, [data?.storesValues]);

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
      showSnackbar(successMessage, 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      showSnackbar(errorMessage, 5000);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    draftMessage,
    draftStore,
    saveSettings,
    setDraftMessage,
    setDraftStore,
    storeOptions,
    submitting,
  };
}
