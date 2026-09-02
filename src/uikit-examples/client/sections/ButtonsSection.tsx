import { useState } from "react";
import { Button, ButtonSize, ButtonVariants } from "@moysklad/uikit/components/Button";
import { HStack } from "@moysklad/uikit/components/HStack";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import { Add20Icon, Delete20Icon, Edit20Icon } from "@moysklad/uikit/icon";
import { Section } from "../Section";

const SNIPPET = `
import { Button, ButtonSize, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Add20Icon } from "@moysklad/uikit/icon";

<Button variant={ButtonVariants.PRIMARY} onClick={save}>Сохранить</Button>
<Button variant={ButtonVariants.SECONDARY} isLoading={isSaving}>Проверить</Button>
<Button variant={ButtonVariants.FRAMELESS}>Отмена</Button>
<Button variant={ButtonVariants.SECONDARY} isIconButton aria-label="Добавить"><Add20Icon /></Button>
<Button variant={ButtonVariants.PRIMARY} size={ButtonSize.L} stretch>На всю ширину</Button>
`;

/** Кнопки: один основной вариант на экран, остальные — второстепенные. */
export function ButtonsSection() {
  const [isLoading, setLoading] = useState(false);

  function simulate(): void {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1500);
  }

  return (
    <Section
      title="Кнопки"
      description="PRIMARY — главное действие формы, SECONDARY — второстепенные, FRAMELESS — отмена и ссылки-действия. В узкой колонке используйте stretch."
      file="ButtonsSection.tsx"
      snippet={SNIPPET}
    >
      <VStack size="s12">
        <HStack size="s8" style={{ flexWrap: "wrap" }}>
          <Button variant={ButtonVariants.PRIMARY}>Primary</Button>
          <Button variant={ButtonVariants.ACCENT}>Accent</Button>
          <Button variant={ButtonVariants.SECONDARY}>Secondary</Button>
          <Button variant={ButtonVariants.ADDITIONAL}>Additional</Button>
          <Button variant={ButtonVariants.FILLED}>Filled</Button>
          <Button variant={ButtonVariants.FRAMELESS}>Frameless</Button>
        </HStack>
        <HStack size="s8" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <Button variant={ButtonVariants.SECONDARY} size={ButtonSize.M}>
            Размер M
          </Button>
          <Button variant={ButtonVariants.SECONDARY} size={ButtonSize.L}>
            Размер L
          </Button>
          <Button variant={ButtonVariants.SECONDARY} size={ButtonSize.XL}>
            Размер XL
          </Button>
        </HStack>
        <HStack size="s8" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <Button variant={ButtonVariants.PRIMARY} isLoading={isLoading} onClick={simulate}>
            {isLoading ? "Сохраняем…" : "Показать загрузку"}
          </Button>
          <Button variant={ButtonVariants.PRIMARY} disabled>
            Недоступна
          </Button>
          <Button variant={ButtonVariants.SECONDARY} isIconButton aria-label="Добавить">
            <Add20Icon />
          </Button>
          <Button variant={ButtonVariants.SECONDARY} isIconButton aria-label="Изменить">
            <Edit20Icon />
          </Button>
          <Button variant={ButtonVariants.SECONDARY} isIconButton aria-label="Удалить">
            <Delete20Icon />
          </Button>
        </HStack>
        <Text.Caption>Кнопка на всю ширину контейнера — типична для виджета:</Text.Caption>
        <Button variant={ButtonVariants.PRIMARY} stretch>
          Подключить интеграцию
        </Button>
      </VStack>
    </Section>
  );
}
