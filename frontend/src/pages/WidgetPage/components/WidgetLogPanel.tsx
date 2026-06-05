import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { formatPayload, type LogEntry } from "../../../lib/widget-sdk";
import { WidgetScrollableLogList } from "./WidgetLayout";

type Props = {
  logs: LogEntry[];
};

export function WidgetLogPanel({ logs }: Props) {
  return (
    <section className="card card--widget" style={{ marginTop: 8 }}>
      <VStack size="s12" style={{ flex: "1 1 auto", minHeight: 0 }}>
        <Text.BodyStrong>Логи</Text.BodyStrong>
        <WidgetScrollableLogList>
          {logs.map((entry, index) => (
            <article className="log-entry" key={`${entry.label}-${index}`}>
              <Text.BodyStrong>{entry.label}</Text.BodyStrong>
              {entry.payload !== undefined ? <pre>{formatPayload(entry.payload)}</pre> : null}
            </article>
          ))}
        </WidgetScrollableLogList>
      </VStack>
    </section>
  );
}
