import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { IframeContext } from "../types";

type Props = {
  data: IframeContext;
};

export function IframeSummaryPanel({ data }: Props) {
  return (
    <section className="card card--summary">
      <VStack size="s12">
        <VStack size="s8">
          <Text.H4>Информация о пользователе</Text.H4>
          <VStack size="s4">
            <Text.Body>
              Пользователь: {data.uid} ({data.fio})
            </Text.Body>
            <Text.Body>Аккаунт: {data.accountId}</Text.Body>
          </VStack>
        </VStack>
        <VStack size="s8">
          <Text.H4>Состояние решения</Text.H4>
          <VStack size="s4">
            <Text.Body>Версия: {data.appVersion}</Text.Body>
            {!data.isSettingsRequired ? (
              <>
                <Text.Body>Сообщение: {data.infoMessage || "—"}</Text.Body>
                <Text.Body>Склад: {data.store || "—"}</Text.Body>
              </>
            ) : null}
          </VStack>
        </VStack>
      </VStack>
    </section>
  );
}
