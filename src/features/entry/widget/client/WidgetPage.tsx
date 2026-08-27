import { useEffect, useRef, useState } from "react";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Help } from "@moysklad/uikit/components/Help";
import { HStack } from "@moysklad/uikit/components/HStack";
import { Text } from "@moysklad/uikit/components/Text";
import { Textfield } from "@moysklad/uikit/components/Textfield";
import { VStack } from "@moysklad/uikit/components/VStack";
import { LogPanel } from "../../ui/LogPanel";
import { describeError, parseMaybeJson, useLog } from "../../ui/log";
import { sdk } from "../../ui/sdk";
import { DialogSection, GoodFolderSection, NavigationSection, PopupSection } from "../../ui/sdk-actions";
import type { WidgetPageData } from "../page-data";
import { diffState, formatDiffs } from "./object-state-diff";

const AUTO_OPEN_FEEDBACK_DELAY_MS = 1000;

/** Виджет в карточке документа: показывает события SDK и дает вызвать его методы. */
export function WidgetPage({ data }: { data: WidgetPageData }) {
  const { entries, log } = useLog();
  const [object, setObject] = useState("—");
  const objectState = useRef<Record<string, unknown>>({});

  useEffect(() => {
    log("SDK initialized", { debug: true });

    sdk.onOpen((message: any) => {
      log("Event: Open", message);

      // МойСклад ждет openFeedback: без него виджет считается не загрузившимся.
      const messageId = message == null ? undefined : message.messageId;
      setTimeout(() => log("auto openFeedback sent", sdk.openFeedback(messageId)), AUTO_OPEN_FEEDBACK_DELAY_MS);

      if (!message || !message.objectId) {
        log("object fetch skipped", { reason: "missing objectId" });
        return;
      }

      fetch(data.getObjectUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextNonce: data.contextNonce, objectId: message.objectId })
      })
        .then(async (response) => {
          const text = await response.text();

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${text}`);
          }

          setObject(text);
        })
        .catch((error: unknown) => log("object fetch error", describeError(error)));
    });

    sdk.onOpenPopup((message: unknown) => log("Event: OpenPopup", message));
    sdk.onChange((message: any) => {
      log("Event: Change", message);

      if (!message || !message.objectState) {
        log("Change ignored", { reason: "missing objectState" });
        return;
      }

      const nextState = message.objectState as Record<string, unknown>;
      log("Event: Change (diff)", formatDiffs(diffState(objectState.current, nextState)));
      objectState.current = nextState;
    });
    sdk.onSave((message: unknown) => log("Event: Save", message));
  }, [data.contextNonce, data.getObjectUrl, log]);

  return (
    <main className="page">
      <section className="card">
        <VStack size="s20">
          <VStack size="s8">
            <HStack size="s4">
              <Text.H3>Текущий пользователь</Text.H3>
              <Help popup="Информацию о текущем пользователе виджет может получить на своем бэкенде через Vendor API" />
            </HStack>
            <Text.Body>
              {data.uid} ({data.fio})
            </Text.Body>
          </VStack>

          <VStack size="s8">
            <HStack size="s4">
              <Text.H3>Открытый объект</Text.H3>
              <Help popup="Используя objectId, переданный в сообщении Open, можем получить через JSON API открытую пользователем сущность/документ" />
            </HStack>
            <pre className="log">{object}</pre>
          </VStack>

          <GoodFolderSection log={log} />
          <NavigationSection log={log} />
          <DialogSection log={log} />
          <DirtyStateSection log={log} />
          <ValidationSection log={log} />
          <UpdateSection log={log} />
          <PopupSection log={log} />
        </VStack>
      </section>
      <section className="card">
        <LogPanel entries={entries} />
      </section>
    </main>
  );
}

type Log = (label: string, payload?: unknown) => void;

function DirtyStateSection({ log }: { log: Log }) {
  return (
    <VStack size="s8">
      <Text.H3>dirty-state</Text.H3>
      <HStack size="s8">
        <Button variant={ButtonVariants.SECONDARY} onClick={() => log("setDirty sent", sdk.setDirty())}>
          Установить
        </Button>
        <Button variant={ButtonVariants.SECONDARY} onClick={() => log("clearDirty sent", sdk.clearDirty())}>
          Очистить
        </Button>
      </HStack>
    </VStack>
  );
}

function ValidationSection({ log }: { log: Log }) {
  const [payloadText, setPayloadText] = useState(
    '{ "name": "ValidationFeedback", "correlationId": 1, "messageId": 1, "valid": false, "message": "Нужно больше печенья" }'
  );

  function send(): void {
    const payload = parseMaybeJson(payloadText) as Record<string, unknown> | string | undefined;
    const fields = payload && typeof payload === "object" ? payload : {};
    const valid = fields.valid !== undefined ? Boolean(fields.valid) : false;
    const message = fields.message !== undefined ? String(fields.message) : undefined;
    const correlationId = fields.correlationId ?? fields.changeMessageId;

    log("validationFeedback sent", sdk.validationFeedback(valid, message, correlationId as any));
  }

  return (
    <VStack size="s8">
      <Text.H3>validation-feedback</Text.H3>
      <Textfield
        name="validationPayload"
        label="Параметры валидации (JSON или text)"
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
      />
      <div>
        <Button variant={ButtonVariants.SECONDARY} onClick={send}>
          Подтвердить
        </Button>
      </div>
    </VStack>
  );
}

function UpdateSection({ log }: { log: Log }) {
  const [payloadText, setPayloadText] = useState('{ "name": "1" }');

  async function update(): Promise<void> {
    try {
      log("update response", await sdk.update(parseMaybeJson(payloadText) as any));
    } catch (error) {
      log("update error", describeError(error));
    }
  }

  return (
    <VStack size="s8">
      <Text.H3>update-provider</Text.H3>
      <Textfield name="updatePayload" label="Параметры обновления (JSON or text)" value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
      <div>
        <Button variant={ButtonVariants.SECONDARY} onClick={update}>
          Обновить
        </Button>
      </div>
    </VStack>
  );
}
