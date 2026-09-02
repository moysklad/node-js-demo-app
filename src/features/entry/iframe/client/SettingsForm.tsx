import { type FormEvent, useState } from "react";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Input } from "@moysklad/uikit/components/Input";
import { Select, type ISelectOption } from "@moysklad/uikit/components/Select";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { AppStatusView, IframePageData } from "../page-data";

const UPDATE_SETTINGS_URL = "/utils/update-settings";

type UpdateSettingsResponse = { message?: string; status?: AppStatusView };

/**
 * Обязательные настройки решения. Пока они не сохранены, решение остается в статусе
 * SettingsRequired; сервер (POST /utils/update-settings) сам меняет статус через Vendor API
 * и возвращает новое состояние для карточки статуса.
 */
export function SettingsForm({
  data,
  onStatusChange
}: {
  data: Pick<IframePageData, "isAdmin" | "infoMessage" | "store" | "storesValues" | "contextNonce">;
  onStatusChange: (status: AppStatusView) => void;
}) {
  const { showSnackbar } = useSnackbar();
  const [infoMessage, setInfoMessage] = useState(data.infoMessage ?? "");
  const [store, setStore] = useState(data.store ?? "");
  const [isSaving, setSaving] = useState(false);

  if (!data.isAdmin) {
    return (
      <VStack size="s8">
        <Text.H2>Форма настроек</Text.H2>
        <Text.Body>Настройки доступны только администратору аккаунта</Text.Body>
      </VStack>
    );
  }

  // Ранее выбранный склад показываем, даже если его больше нет в списке JSON API.
  const storeNames = data.store && !data.storesValues.includes(data.store) ? [data.store, ...data.storesValues] : data.storesValues;
  const storeOptions: ISelectOption<string>[] = storeNames.map((name) => ({ label: name, value: name }));

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(UPDATE_SETTINGS_URL, {
        method: "POST",
        credentials: "same-origin",
        body: new URLSearchParams({ infoMessage, store, contextNonce: data.contextNonce })
      });
      const contentType = response.headers.get("content-type") || "";
      const payload: UpdateSettingsResponse | string = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      const message = typeof payload === "string" ? payload : payload.message;

      if (!response.ok) {
        showSnackbar({ message: message || "Не удалось сохранить настройки", variant: "error" });
        return;
      }

      showSnackbar({ message: message || "Настройки обновлены", variant: "success" });

      if (typeof payload !== "string" && payload.status) {
        onStatusChange(payload.status);
      }
    } catch {
      showSnackbar({ message: "Не удалось сохранить настройки", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <VStack size="s12">
        <Text.H2>Форма настроек</Text.H2>
        <Input
          name="infoMessage"
          label="Укажите сообщение"
          value={infoMessage}
          onChange={(event) => setInfoMessage(event.target.value)}
        />
        <Select<string>
          label="Выберите склад"
          placeholder="Склад не выбран"
          options={storeOptions}
          value={storeOptions.find((option) => option.value === store)}
          onChange={(option) => setStore(String(option.value))}
          fullWidth
        />
        <div>
          <Button type="submit" variant={ButtonVariants.PRIMARY} isLoading={isSaving}>
            Сохранить
          </Button>
        </div>
      </VStack>
    </form>
  );
}
