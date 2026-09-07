import { useState } from "react";
import { Banner } from "@moysklad/uikit/components/Banner";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { sdk } from "../../../features/entry/ui/sdk";
import { Section } from "../Section";

const SNIPPET = `
// Дескриптор решения (src/utils/descriptor.ts):
// <popups><popup><name>some-popup</name><sourceUrl>https://…/entry/popup</sourceUrl></popup></popups>
import { sdk } from "../../../features/entry/ui/sdk";

// Из главного iframe, виджета или кнопки. МойСклад открывает попап поверх своего интерфейса,
// промис резолвится, когда попап вызовет sdk.closePopup(popupResponse).
const response = await sdk.showPopup("some-popup", { orderId: "00123" });
`;

/** Диалоги: не модалки внутри iframe, а попап МоегоСклада через протокол JS Widget SDK. */
export function PopupSection() {
  const [result, setResult] = useState<string | null>(null);
  const [isOpening, setOpening] = useState(false);

  async function openPopup(): Promise<void> {
    setOpening(true);
    setResult(null);

    try {
      const response = await sdk.showPopup("some-popup", { source: "uikit-examples" });
      setResult(`Ответ попапа: ${JSON.stringify(response)}`);
    } catch (error) {
      setResult(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOpening(false);
    }
  }

  return (
    <Section
      title="Попапы вместо модальных окон"
      description="Для диалогов используйте попапы МоегоСклада: sdk.showPopup() открывает страницу решения поверх всего интерфейса, а sdk.closePopup(popupResponse) возвращает результат. Modal, Sidepage и Snackbar кита внутри iframe не рекомендуем."
      file="PopupSection.tsx"
      snippet={SNIPPET}
    >
      <VStack size="s12">
        <Banner
          type="warning"
          title="Почему не Modal внутри iframe"
          subtitle="Главный iframe растет вместе с контентом, а position: fixed считается от всего iframe, а не от экрана: после прокрутки страницы МоегоСклада модалка или снекбар остаются за экраном. В виджете шириной 400px модальному окну просто нет места. Попап открывается самим МоемСкладом — поверх страницы и по центру экрана."
        />
        <Text.Body>
          Страница попапа — обычная страница решения (здесь: <code>src/features/entry/popup/</code>); ее адрес объявлен в дескрипторе
          в секции <code>&lt;popups&gt;</code>. Попап получает событие OpenPopup с параметрами вызова и закрывает себя
          через <code>sdk.closePopup()</code>.
        </Text.Body>
        <div>
          <Button variant={ButtonVariants.PRIMARY} onClick={openPopup} isLoading={isOpening}>
            Открыть попап
          </Button>
        </div>
        {/* Ответ — JSON без пробелов: без переноса строка вылезает за карточку в узкой колонке. */}
        {result && <Text.Caption style={{ overflowWrap: "anywhere" }}>{result}</Text.Caption>}
      </VStack>
    </Section>
  );
}
