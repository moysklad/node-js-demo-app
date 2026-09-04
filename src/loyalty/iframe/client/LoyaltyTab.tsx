import { useState } from "react";
import { Badge } from "@moysklad/uikit/components/Badge";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { LoyaltyConnectionState } from "../../types";
import { AuthModal } from "./AuthModal";
import { ManualModal } from "./ManualModal";

export type LoyaltyTabProps = {
  isAdmin: boolean;
  contextNonce: string;
  loyalty: LoyaltyConnectionState;
  defaultLoyaltyProviderUrl: string;
};

const EXAMPLE_REQUEST = `curl -X PUT \\
"https://apps-api.moysklad.ru/api/vendor/1.0/apps/5f3c5489-6a17-48b7-9fe5-b2000eb807fe/f088b0a7-9490-4a57-b804-393163e7680f/loyalty" \\
-H "Content-Type: application/json" \\
-H "Accept: application/json" \\
-H "Authorization: Bearer ..." \\
-d '{
  "url": "https://...",
  "token": "...",
  "externalSearch": false
}'`;

/**
 * Вкладка «Программа лояльности» основного iframe. Подключение необязательно и на статус
 * решения не влияет, поэтому вкладка живет отдельно от формы настроек.
 */
export function LoyaltyTab({ isAdmin, contextNonce, loyalty: initialLoyalty, defaultLoyaltyProviderUrl }: LoyaltyTabProps) {
  const [loyalty, setLoyalty] = useState(initialLoyalty);
  const [isExampleOpen, setExampleOpen] = useState(false);
  const [isOnboardingOpen, setOnboardingOpen] = useState(false);
  const [dialog, setDialog] = useState<"auth" | "manual" | null>(null);

  return (
    <main className="page">
      <section className="card page__wide">
        <VStack size="s8">
          <Text.H2>Состояние программы лояльности</Text.H2>
          <Text.Body>
            Подключение программы лояльности не обязательно и на статус решения не влияет: эта точка встраивания
            нужна только вендорам программ лояльности.
          </Text.Body>
          <div>
            <Badge variant={loyalty.badge} label={loyalty.title} />
          </div>
          <Text.Body>{loyalty.details}</Text.Body>
        </VStack>
      </section>

      {!isOnboardingOpen && (
        <section className="card page__wide">
          <VStack size="s12">
            <Text.BodyStrong>
              Чтобы МойСклад мог обращаться к API программы лояльности, передайте адрес вашего API и токен доступа с
              помощью Vendor API.
            </Text.BodyStrong>
            <div>
              <Button variant={ButtonVariants.FRAMELESS} onClick={() => setExampleOpen((value) => !value)}>
                {isExampleOpen ? "Скрыть пример запроса" : "Показать пример запроса"}
              </Button>
            </div>
            {isExampleOpen && <pre className="log">{EXAMPLE_REQUEST}</pre>}
            <Text.Body>
              Получить эти данные можно после идентификации пользователя по логину и паролю в программе лояльности —
              рекомендуем этот способ. Также допустимо предложить пользователю ввести адрес API, токен и указать режим
              внешнего поиска покупателей напрямую.
            </Text.Body>
            {isAdmin ? (
              <div>
                <Button variant={ButtonVariants.PRIMARY} onClick={() => setOnboardingOpen(true)}>
                  Перейти к примерам реализации
                </Button>
              </div>
            ) : (
              <Text.Body>Подключение программы лояльности доступно только администратору аккаунта</Text.Body>
            )}
          </VStack>
        </section>
      )}

      {isAdmin && isOnboardingOpen && (
        <>
          <div className="page__wide">
            <Button variant={ButtonVariants.FRAMELESS} onClick={() => setOnboardingOpen(false)}>
              ← К описанию
            </Button>
          </div>

          <section className="card">
            <VStack size="s12">
              <div>
                <Badge variant="green" label="Рекомендованный способ" />
              </div>
              <Text.H2>Настройка через авторизацию или регистрацию</Text.H2>
              <Text.Body>
                Пользователь входит в программу лояльности, а ее провайдер сам находит настройки и передает их в
                МойСклад. Этот вариант подходит для непосредственных провайдеров программы лояльности.
              </Text.Body>
              <div>
                <Button variant={ButtonVariants.PRIMARY} onClick={() => setDialog("auth")}>
                  Попробовать
                </Button>
              </div>
            </VStack>
          </section>

          <section className="card">
            <VStack size="s12">
              <div>
                <Badge variant="grey" label="Допустимый способ" />
              </div>
              <Text.H2>Прямая передача настроек</Text.H2>
              <Text.Body>
                Вы запрашиваете у пользователя URL, токен и режим внешнего поиска покупателей напрямую. Этот вариант
                можно использовать, когда по логину и паролю невозможно получить настройки программы лояльности.
              </Text.Body>
              <div>
                <Button variant={ButtonVariants.SECONDARY} onClick={() => setDialog("manual")}>
                  Попробовать
                </Button>
              </div>
            </VStack>
          </section>

          <AuthModal isVisible={dialog === "auth"} onClose={() => setDialog(null)} />
          <ManualModal
            isVisible={dialog === "manual"}
            contextNonce={contextNonce}
            defaultProviderUrl={defaultLoyaltyProviderUrl}
            savedExternalSearch={loyalty.externalSearch}
            onClose={() => setDialog(null)}
            onConnected={setLoyalty}
          />
        </>
      )}
    </main>
  );
}
