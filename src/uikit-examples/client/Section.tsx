import { type ReactNode, useState } from "react";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";

type SectionProps = {
  title: string;
  /** Когда этот набор компонентов нужен вендору. */
  description: string;
  /** Имя файла секции в src/uikit-examples/client/sections — там полный код. */
  file: string;
  /** Ключевой фрагмент кода: импорт + JSX, 5–15 строк. */
  snippet: string;
  children: ReactNode;
};

/** Карточка одного примера: описание, живое демо и фрагмент кода под копирование. */
export function Section({ title, description, file, snippet, children }: SectionProps) {
  const [isCodeOpen, setCodeOpen] = useState(false);

  return (
    <section className="card page__wide">
      <VStack size="s12">
        <Text.H3>{title}</Text.H3>
        <Text.Body>{description}</Text.Body>
        {children}
        <div>
          <Button variant={ButtonVariants.FRAMELESS} withHorisontalPadding onClick={() => setCodeOpen((value) => !value)}>
            {isCodeOpen ? "Скрыть код" : "Показать код"}
          </Button>
        </div>
        {isCodeOpen && (
          <VStack size="s4">
            <pre className="log">{snippet.trim()}</pre>
            <Text.Caption>Полный код: src/uikit-examples/client/sections/{file}</Text.Caption>
          </VStack>
        )}
      </VStack>
    </section>
  );
}
