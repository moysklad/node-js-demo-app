import { useRef, useState } from "react";
import { Banner } from "@moysklad/uikit/components/Banner";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { Dropdown } from "@moysklad/uikit/components/Dropdown";
import { Help } from "@moysklad/uikit/components/Help";
import { Hint, HintVariant } from "@moysklad/uikit/components/Hint";
import { HStack } from "@moysklad/uikit/components/HStack";
import { Modal } from "@moysklad/uikit/components/Modal";
import { Sidepage, SidepageContent, SidepageFooter, SidepageHeader } from "@moysklad/uikit/components/Sidepage";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { Text } from "@moysklad/uikit/components/Text";
import { Tooltip, Placement } from "@moysklad/uikit/components/Tooltip";
import { VStack } from "@moysklad/uikit/components/VStack";
import { OverlayPortal } from "../../../features/entry/ui/overlay-root";
import { Section } from "../Section";

const SNIPPET = `
import { Modal } from "@moysklad/uikit/components/Modal";
import { OverlayPortal } from "../../../features/entry/ui/overlay-root";

// OverlayPortal рисует оверлей в видимой части iframe (иначе после скролла он останется за экраном).
<OverlayPortal>
<Modal isVisible={isOpen} onClose={() => setOpen(false)} maxWidth={520}>
  <Modal.Header><Text.H2>Удалить связь с товаром?</Text.H2></Modal.Header>
  <Modal.Body><Text.Body>Товар останется в МоемСкладе.</Text.Body></Modal.Body>
  <Modal.Footer>
    <Button variant={ButtonVariants.PRIMARY} onClick={confirm}>Удалить</Button>
    <Button variant={ButtonVariants.FRAMELESS} onClick={() => setOpen(false)}>Отмена</Button>
  </Modal.Footer>
</Modal>
</OverlayPortal>
`;

/** Оверлеи: модальное окно, боковая панель, выпадающее меню и подсказки. */
export function OverlaysSection() {
  const { showSnackbar } = useSnackbar();
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSidepageOpen, setSidepageOpen] = useState(false);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const dropdownTrigger = useRef<HTMLButtonElement>(null);

  function pick(action: string): void {
    setDropdownOpen(false);
    showSnackbar({ message: `Выбрано: ${action}`, variant: "info" });
  }

  return (
    <Section
      title="Оверлеи"
      description="Modal — подтверждение и короткие формы, Sidepage — длинная форма или карточка, Dropdown — меню действий, Help/Hint/Tooltip — подсказки."
      file="OverlaysSection.tsx"
      snippet={SNIPPET}
    >
      <VStack size="s12">
        <Banner
          type="warning"
          title="Оверлеи не выходят за рамку iframe"
          subtitle="Модальные окна и панели рисуются внутри страницы решения, а не поверх всего МоегоСклада. Snackbar, Modal и Sidepage здесь рендерятся в контейнер видимой части iframe (OverlayPortal из ui/overlay-root.tsx), иначе после скролла страницы они остались бы за экраном. В виджете шириной 400px Sidepage перекроет весь виджет — используйте Modal или откройте попап через sdk.showPopup()."
        />
        <HStack size="s8" style={{ flexWrap: "wrap" }}>
          <Button variant={ButtonVariants.SECONDARY} onClick={() => setModalOpen(true)}>
            Открыть Modal
          </Button>
          <Button variant={ButtonVariants.SECONDARY} onClick={() => setSidepageOpen(true)}>
            Открыть Sidepage
          </Button>
          <Button ref={dropdownTrigger} variant={ButtonVariants.SECONDARY} onClick={() => setDropdownOpen((value) => !value)}>
            Действия ▾
          </Button>
        </HStack>
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
      </VStack>

      <OverlayPortal>
        <Modal isVisible={isModalOpen} onClose={() => setModalOpen(false)} maxWidth={520}>
          <Modal.Header>
            <Text.H2>Удалить связь с товаром?</Text.H2>
          </Modal.Header>
          <Modal.Body>
            <Text.Body>Товар останется в МоемСкладе, но перестанет обновляться из сервиса.</Text.Body>
          </Modal.Body>
          <Modal.Footer>
            <HStack size="s8">
              <Button
                variant={ButtonVariants.PRIMARY}
                onClick={() => {
                  setModalOpen(false);
                  showSnackbar({ message: "Связь удалена", variant: "success" });
                }}
              >
                Удалить
              </Button>
              <Button variant={ButtonVariants.FRAMELESS} onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
            </HStack>
          </Modal.Footer>
        </Modal>
      </OverlayPortal>

      <OverlayPortal>
        <Sidepage isOpen={isSidepageOpen} onClose={() => setSidepageOpen(false)} width={480} withBackdrop closeOnBackdropClick>
          <SidepageHeader>
            <Text.H2>Карточка заказа №00123</Text.H2>
          </SidepageHeader>
          <SidepageContent>
            <VStack size="s8">
              <Text.Body>Покупатель: ООО «Ромашка»</Text.Body>
              <Text.Body>Статус в сервисе: Отгружен</Text.Body>
              <Text.Body>Сумма: 12 480 ₽</Text.Body>
            </VStack>
          </SidepageContent>
          <SidepageFooter>
            <Button variant={ButtonVariants.PRIMARY} onClick={() => setSidepageOpen(false)}>
              Закрыть
            </Button>
          </SidepageFooter>
        </Sidepage>
      </OverlayPortal>

      <Dropdown open={isDropdownOpen} onClose={() => setDropdownOpen(false)} triggerRef={dropdownTrigger}>
        <VStack size="s0" style={{ padding: 8 }}>
          <Button variant={ButtonVariants.FRAMELESS} onClick={() => pick("Выгрузить заказ")}>
            Выгрузить заказ
          </Button>
          <Button variant={ButtonVariants.FRAMELESS} onClick={() => pick("Обновить остатки")}>
            Обновить остатки
          </Button>
          <Button variant={ButtonVariants.FRAMELESS} onClick={() => pick("Отвязать")}>
            Отвязать
          </Button>
        </VStack>
      </Dropdown>
    </Section>
  );
}
