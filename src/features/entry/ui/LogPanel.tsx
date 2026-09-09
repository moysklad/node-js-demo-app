import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { formatLogEntry, type LogEntry } from "./log";

export function LogPanel({ entries }: { entries: LogEntry[] }) {
  return (
    <VStack size="s8">
      <Text.H3>Логи</Text.H3>
      <pre className="log">{entries.map(formatLogEntry).join("\n\n")}</pre>
    </VStack>
  );
}
