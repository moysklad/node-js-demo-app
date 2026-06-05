import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { formatPayload, type LogEntry } from "../../lib/sdk";

type Props = {
  logs: LogEntry[];
};

export function WidgetLogPanel({ logs }: Props) {
  return (
    <section className="card card--widget card--widget-logs">
      <VStack size="s12" className="widget-card-content">
        <Text.BodyStrong>Логи</Text.BodyStrong>
        <div className="log-list widget-log-list">
          {logs.map((entry, index) => (
            <article className="log-entry" key={`${entry.label}-${index}`}>
              <Text.BodyStrong>{entry.label}</Text.BodyStrong>
              {entry.payload !== undefined ? <pre>{formatPayload(entry.payload)}</pre> : null}
            </article>
          ))}
        </div>
      </VStack>
    </section>
  );
}
