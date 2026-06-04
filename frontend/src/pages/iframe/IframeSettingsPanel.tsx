import { Badge } from "@moysklad/uikit/components/Badge";
import { Button } from "@moysklad/uikit/components/Button";
import { Input } from "@moysklad/uikit/components/Input";
import { Select } from "@moysklad/uikit/components/Select";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { IframeContext } from "../../lib/sdk";

type StoreOption = {
  label: string;
  value: string | number;
};

type Props = {
  data: IframeContext;
  draftMessage: string;
  draftStore: string;
  submitting: boolean;
  storeOptions: StoreOption[];
  onDraftMessageChange: (value: string) => void;
  onDraftStoreChange: (value: string) => void;
  onSave: () => void;
};

export function IframeSettingsPanel({
  data,
  draftMessage,
  draftStore,
  submitting,
  storeOptions,
  onDraftMessageChange,
  onDraftStoreChange,
  onSave,
}: Props) {
  const selectedStoreOption = draftStore
    ? storeOptions.find((option) => option.value === draftStore)
    : undefined;

  return (
    <section className="card card--settings">
      <VStack size="s12">
        <Badge
          label={data.isSettingsRequired ? "Требуется настройка" : "Решение готово к работе"}
          variant={data.isSettingsRequired ? "orange" : "green"}
        />
        {data.isAdmin ? (
          <VStack size="s12">
            <Input
              name="infoMessage"
              label="Сообщение"
              info="Сообщение для сохранения в настройках"
              value={draftMessage}
              onChange={(event) => onDraftMessageChange(event.target.value)}
            />
            <Select
              label="Склад"
              info="Выберите название склада"
              searchable
              fullWidth
              isDisableEnterSelect
              options={storeOptions}
              value={selectedStoreOption}
              placeholder="Выберите склад"
              inputProps={{
                onKeyDown: (event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                  }
                },
              }}
              onChange={(option) => onDraftStoreChange(String(option.value))}
            />
            <div>
              <Button type="button" variant="primary" isLoading={submitting} onClick={onSave}>
                {submitting ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </VStack>
        ) : (
          <Text.Body>Настройки доступны только администратору аккаунта.</Text.Body>
        )}
      </VStack>
    </section>
  );
}
