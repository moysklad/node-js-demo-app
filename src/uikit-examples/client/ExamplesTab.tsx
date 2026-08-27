import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";

/**
 * Вкладка «Примеры UI Kit». Пока заглушка: сюда будут добавляться компоненты
 * @moysklad/uikit, которые чаще всего нужны в iframe решения.
 */
export function ExamplesTab() {
  return (
    <main className="page">
      <section className="card page__wide">
        <VStack size="s8">
          <Text.H2>Примеры UI Kit</Text.H2>
          <Text.Body>
            Раздел наполняется. Здесь появятся примеры компонентов <code>@moysklad/uikit</code>, полезных в iframe
            решения: формы, уведомления, модальные окна, таблицы.
          </Text.Body>
        </VStack>
      </section>
    </main>
  );
}
