import { useRef, useState } from "react";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Dropdown } from "@moysklad/uikit/components/Dropdown";
import { Help } from "@moysklad/uikit/components/Help";
import { Hint, HintVariant } from "@moysklad/uikit/components/Hint";
import { HStack } from "@moysklad/uikit/components/HStack";
import { Text } from "@moysklad/uikit/components/Text";
import { Tooltip, Placement } from "@moysklad/uikit/components/Tooltip";
import { VStack } from "@moysklad/uikit/components/VStack";
import { Section } from "../Section";

const SNIPPET = `
import { Dropdown } from "@moysklad/uikit/components/Dropdown";
import { Help } from "@moysklad/uikit/components/Help";
import { Hint, HintVariant } from "@moysklad/uikit/components/Hint";
import { Tooltip, Placement } from "@moysklad/uikit/components/Tooltip";

<Help popup="Ключ API можно получить в личном кабинете сервиса." />
<Hint overlay="Действие необратимо" variant={HintVariant.Alert} placement={Placement.TOP}><Text.Body>Удалить</Text.Body></Hint>
<Tooltip overlay="Подсказка" placement={Placement.BOTTOM}><Text.Body>Наведите</Text.Body></Tooltip>

const trigger = useRef<HTMLButtonElement>(null);
<Button ref={trigger} onClick={() => setOpen((value) => !value)}>Действия</Button>
<Dropdown open={isOpen} onClose={() => setOpen(false)} triggerRef={trigger}>…</Dropdown>
`;

const ACTIONS = ["Выгрузить заказ", "Обновить остатки", "Отвязать"];

/** Подсказки и меню: привязаны к элементу-триггеру, поэтому в iframe работают без оговорок. */
export function HintsSection() {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const dropdownTrigger = useRef<HTMLButtonElement>(null);

  function pick(action: string): void {
    setDropdownOpen(false);
    setLastAction(action);
  }

  return (
    <Section
      title="Подсказки и меню"
      description="Help — вопросик рядом с полем, Hint и Tooltip — подсказка при наведении, Dropdown — меню действий у кнопки. Все они позиционируются от своего элемента и прокручиваются вместе с контентом."
      file="HintsSection.tsx"
      snippet={SNIPPET}
    >
      <VStack size="s12">
        <HStack size="s12" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <HStack size="s4" style={{ alignItems: "center" }}>
            <Text.Body>Help рядом с полем</Text.Body>
            <Help popup="Ключ API можно получить в личном кабинете сервиса, раздел «Интеграции»." />
          </HStack>
          <Hint overlay="Внимание: действие необратимо" variant={HintVariant.Alert} placement={Placement.TOP}>
            <Text.Body>Hint при наведении</Text.Body>
          </Hint>
          <Tooltip overlay="Tooltip с произвольным содержимым" placement={Placement.BOTTOM} offset={[0, 8]}>
            <Text.Body>Tooltip при наведении</Text.Body>
          </Tooltip>
        </HStack>
        <HStack size="s8" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <Button ref={dropdownTrigger} variant={ButtonVariants.SECONDARY} onClick={() => setDropdownOpen((value) => !value)}>
            Действия ▾
          </Button>
          {lastAction && <Text.Caption>Выбрано: {lastAction}</Text.Caption>}
        </HStack>
      </VStack>

      <Dropdown open={isDropdownOpen} onClose={() => setDropdownOpen(false)} triggerRef={dropdownTrigger}>
        <VStack size="s0" style={{ padding: 8 }}>
          {ACTIONS.map((action) => (
            <Button key={action} variant={ButtonVariants.FRAMELESS} onClick={() => pick(action)}>
              {action}
            </Button>
          ))}
        </VStack>
      </Dropdown>
    </Section>
  );
}
