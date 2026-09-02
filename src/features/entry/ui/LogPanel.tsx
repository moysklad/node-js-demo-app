import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { formatLogEntry, type LogEntry } from "./log";

export function LogPanel({ entries }: { entries: LogEntry[] }) {
  return (
    <VStack size="s8">
      <Text.H2>Логи</Text.H2>
      <pre className="log">{entries.map(formatLogEntry).join("\n\n")}</pre>
    </VStack>
  );
}
