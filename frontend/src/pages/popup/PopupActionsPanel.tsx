import { useState } from "react";
import { Button } from "@moysklad/uikit/components/Button";
import { Input } from "@moysklad/uikit/components/Input";
import { Tabs } from "@moysklad/uikit/components/Tabs";
import { Text } from "@moysklad/uikit/components/Text";
import { Textfield } from "@moysklad/uikit/components/Textfield";
import { VStack } from "@moysklad/uikit/components/VStack";

type Props = {
  onSelectFolder: () => Promise<void>;
  onNavigate: (path: string) => Promise<void>;
  onShowDialog: (dialogText: string, dialogButtons: string) => Promise<void>;
  onShowPopup: (popupName: string, popupParams: string) => Promise<void>;
  onClosePopup: () => void;
};

export function PopupActionsPanel(props: Props) {
  const { onSelectFolder, onNavigate, onShowDialog, onShowPopup, onClosePopup } = props;

  const [activeTab, setActiveTab] = useState("good-folder");
  const [navigatePath, setNavigatePath] = useState("#customerorder?sort=o.moment%20d");
  const [dialogText, setDialogText] = useState("Hello from SDK");
  const [dialogButtons, setDialogButtons] = useState(
    '[{ "name": "Yes", "caption": "Да, удалить" },{ "name": "No", "caption": "Нет" }]'
  );
  const [popupName, setPopupName] = useState("some-popup");
  const [popupParams, setPopupParams] = useState('{ "foo": "bar" }');

  return (
    <section className="card">
      <VStack size="s12">
        <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))} aria-label="Popup actions">
          <Tabs.Item value="good-folder">Группы</Tabs.Item>
          <Tabs.Item value="navigation">Навигация</Tabs.Item>
          <Tabs.Item value="dialogs">Диалог</Tabs.Item>
          <Tabs.Item value="popups">Popup</Tabs.Item>
        </Tabs>

        {activeTab === "good-folder" ? (
          <section className="widget-section">
            <Text.H4>Выбор группы товаров</Text.H4>
            <div>
              <Button type="button" variant="primary" onClick={() => void onSelectFolder()}>
                Выбрать
              </Button>
            </div>
          </section>
        ) : null}

        {activeTab === "navigation" ? (
          <section className="widget-section">
            <Text.H4>Навигация</Text.H4>
            <Input name="popupNavigatePath" label="Путь" value={navigatePath} onChange={(event) => setNavigatePath(event.target.value)} />
            <div>
              <Button type="button" variant="primary" onClick={() => void onNavigate(navigatePath.trim() || "/")}>
                Перейти
              </Button>
            </div>
          </section>
        ) : null}

        {activeTab === "dialogs" ? (
          <section className="widget-section">
            <Text.H4>Диалог</Text.H4>
            <Input name="popupDialogText" label="Текст диалога" value={dialogText} onChange={(event) => setDialogText(event.target.value)} />
            <Textfield
              name="popupDialogButtons"
              label="Кнопки диалога (JSON)"
              value={dialogButtons}
              onChange={(event) => setDialogButtons(event.target.value)}
              rows={5}
            />
            <div>
              <Button type="button" variant="primary" onClick={() => void onShowDialog(dialogText.trim() || "Dialog", dialogButtons)}>
                Открыть
              </Button>
            </div>
          </section>
        ) : null}

        {activeTab === "popups" ? (
          <section className="widget-section">
            <Text.H4>Popup</Text.H4>
            <Input name="popupName" label="Название попапа" value={popupName} onChange={(event) => setPopupName(event.target.value)} />
            <Textfield
              name="popupParams"
              label="Параметры попапа (JSON)"
              value={popupParams}
              onChange={(event) => setPopupParams(event.target.value)}
              rows={5}
            />
            <div className="row row--actions">
              <Button type="button" variant="primary" onClick={() => void onShowPopup(popupName.trim() || "popup", popupParams)}>
                Открыть
              </Button>
              <Button type="button" variant="secondary" onClick={onClosePopup}>
                Закрыть
              </Button>
            </div>
          </section>
        ) : null}
      </VStack>
    </section>
  );
}
