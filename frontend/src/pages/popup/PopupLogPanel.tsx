import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { formatPayload, type LogEntry } from "../../lib/sdk";

type Props = {
  logs: LogEntry[];
};

export function PopupLogPanel(props: Props) {
  const { logs } = props;

  return (
    <section className="card card--popup-logs">
      <VStack size="s12" className="popup-log-content">
        <Text.H3>Логи</Text.H3>

        <div className="log-list popup-log-list">
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
