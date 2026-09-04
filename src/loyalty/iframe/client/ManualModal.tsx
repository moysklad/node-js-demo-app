import { type FormEvent, useEffect, useState } from "react";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Checkbox } from "@moysklad/uikit/components/Checkbox";
import { HStack } from "@moysklad/uikit/components/HStack";
import { Input } from "@moysklad/uikit/components/Input";
import { Modal } from "@moysklad/uikit/components/Modal";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { LoyaltyConnectionState } from "../../types";
import { readLoyaltyConnectResponse } from "./tab-response";

const CONNECT_URL = "/utils/connect-loyalty";

type ManualModalProps = {
  isVisible: boolean;
  contextNonce: string;
  defaultProviderUrl: string;
  /** Сохраненный режим внешнего поиска — им инициализируется чекбокс при открытии. */
  savedExternalSearch: boolean;
  onClose: () => void;
  onConnected: (state: LoyaltyConnectionState) => void;
};

// Токен уникален для каждой установки: решение ищет установку только по токену,
// поэтому общий токен по умолчанию отдавал бы данные первой установки с таким же токеном.
function generateProviderToken(): string {
  return crypto.randomUUID();
}

/**
 * Прямая передача настроек: URL, токен и режим внешнего поиска уходят на бэкенд решения
 * (POST /utils/connect-loyalty), а тот сохраняет их у себя и отправляет в МойСклад через Vendor API.
 */
export function ManualModal({ isVisible, contextNonce, defaultProviderUrl, savedExternalSearch, onClose, onConnected }: ManualModalProps) {
  const { showSnackbar } = useSnackbar();
  const [providerUrl, setProviderUrl] = useState(defaultProviderUrl);
  const [providerToken, setProviderToken] = useState(generateProviderToken);
  const [externalSearch, setExternalSearch] = useState(savedExternalSearch);
  const [isSending, setSending] = useState(false);
  const [sentRequest, setSentRequest] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      setExternalSearch(savedExternalSearch);
    }
  }, [isVisible, savedExternalSearch]);

  function close(): void {
    setProviderUrl(defaultProviderUrl);
    setProviderToken(generateProviderToken());
    setSentRequest(null);
    onClose();
  }

  // Правка любого поля после отправки возвращает кнопку «Сформировать настройки»:
  // иначе изменение молча терялось бы за кнопкой «Завершить настройку», которая только закрывает окно.
  function edit<T>(setter: (value: T) => void): (value: T) => void {
    return (value) => {
      setter(value);
      setSentRequest(null);
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    setSentRequest(null);

    try {
      const response = await fetch(CONNECT_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerUrl: providerUrl.trim(), providerToken: providerToken.trim(), externalSearch, contextNonce })
      });
      const payload = await readLoyaltyConnectResponse(response);
      const message = typeof payload === "string" ? payload : payload.message;

      if (!response.ok) {
        throw new Error(message || "Не удалось настроить Loyalty API");
      }

      showSnackbar({ message: message || "Loyalty API настроен", variant: "success" });
      setSentRequest(formatManualRequest(providerUrl.trim(), providerToken.trim(), externalSearch));

      if (typeof payload !== "string" && payload.loyalty) {
        onConnected(payload.loyalty);
      }
    } catch (error) {
      showSnackbar({ message: error instanceof Error ? error.message : "Не удалось настроить Loyalty API", variant: "error" });
    } finally {
      setSending(false);
    }
  }

  // Modal.Provider дает модалке контекст (Escape) и уносит в портал все, что в него обернуто, — только сам Modal.
  return (
    <Modal.Provider>
      <Modal isVisible={isVisible} onClose={close} maxWidth={560}>
        <Modal.Header>
          <VStack size="s4">
            <Text.H2>Ручная настройка</Text.H2>
            <Text.Body>Запросите у пользователя адрес API, токен доступа и режим внешнего поиска покупателей.</Text.Body>
          </VStack>
        </Modal.Header>
        <Modal.Body>
          <form id="manualForm" onSubmit={submit}>
            <VStack size="s12">
              <Input
                name="providerUrl"
                label="URL программы лояльности"
                type="url"
                info="Base URL, по которому МойСклад будет обращаться к API программы лояльности."
                placeholder={defaultProviderUrl}
                value={providerUrl}
                onChange={(e) => edit(setProviderUrl)(e.target.value)}
                required
              />
              <Input
                name="providerToken"
                label="Токен доступа"
                type="password"
                info="Токен, который МойСклад будет использовать при обращении к API."
                placeholder="token"
                autoComplete="off"
                value={providerToken}
                onChange={(e) => edit(setProviderToken)(e.target.value)}
                required
              />
              <Checkbox
                name="externalSearch"
                label="Использовать внешний поиск покупателей"
                checked={externalSearch}
                onChange={(e) => edit(setExternalSearch)((e.target as HTMLInputElement).checked)}
              />
              {sentRequest && <pre className="log">{sentRequest}</pre>}
            </VStack>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <HStack size="s8">
            {sentRequest ? (
              <Button variant={ButtonVariants.PRIMARY} onClick={close}>
                Завершить настройку
              </Button>
            ) : (
              <Button type="submit" form="manualForm" variant={ButtonVariants.PRIMARY} isLoading={isSending}>
                Сформировать настройки
              </Button>
            )}
            <Button variant={ButtonVariants.FRAMELESS} onClick={close}>
              Назад
            </Button>
          </HStack>
        </Modal.Footer>
      </Modal>
    </Modal.Provider>
  );
}

function formatManualRequest(providerUrl: string, providerToken: string, externalSearch: boolean): string {
  return [
    "PUT https://apps-api.moysklad.ru/api/vendor/1.0/apps/{appId}/{accountId}/loyalty",
    "",
    "{",
    `  "url": "${providerUrl}",`,
    `  "token": "${providerToken}",`,
    `  "externalSearch": ${String(externalSearch)}`,
    "}"
  ].join("\n");
}
