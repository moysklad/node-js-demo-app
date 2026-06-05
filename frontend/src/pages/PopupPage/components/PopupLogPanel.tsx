import { Text } from "@moysklad/uikit/components/Text";
import { formatPayload, type LogEntry } from "../../../lib/widget-sdk";
import { PopupLogBody, PopupLogCard, PopupScrollableLogList } from "./PopupLayout";

type Props = {
  logs: LogEntry[];
};

export function PopupLogPanel(props: Props) {
  const { logs } = props;

  return (
    <PopupLogCard>
      <PopupLogBody>
        <Text.H3>Логи</Text.H3>

        <PopupScrollableLogList>
          {logs.map((entry, index) => (
            <article className="log-entry" key={`${entry.label}-${index}`}>
              <Text.BodyStrong>{entry.label}</Text.BodyStrong>
              {entry.payload !== undefined ? <pre>{formatPayload(entry.payload)}</pre> : null}
            </article>
          ))}
        </PopupScrollableLogList>
      </PopupLogBody>
    </PopupLogCard>
  );
}
