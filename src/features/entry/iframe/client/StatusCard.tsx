import { Badge } from "@moysklad/uikit/components/Badge";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { AppStatusView } from "../page-data";

/** Статус решения (SettingsRequired/Activated) — тот, что решение сообщает в Vendor API. */
export function StatusCard({ appVersion, status }: { appVersion: string; status: AppStatusView }) {
  return (
    <VStack size="s8" style={{ marginTop: 24 }}>
      <Text.H2>Состояние решения</Text.H2>
      <Text.Caption>Версия {appVersion}</Text.Caption>
      <div>
        <Badge variant={status.className === "status-ready" ? "green" : "orange"} label={status.title} />
      </div>
      {status.showDetails && (
        <Text.Body>
          Сообщение: {status.infoMessage}
          <br />
          Выбран склад: {status.store}
        </Text.Body>
      )}
    </VStack>
  );
}
