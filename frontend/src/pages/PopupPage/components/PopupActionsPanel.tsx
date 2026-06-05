import { useState } from "react";
import { Button } from "@moysklad/uikit/components/Button";
import { Input } from "@moysklad/uikit/components/Input";
import { Tabs } from "@moysklad/uikit/components/Tabs";
import { Text } from "@moysklad/uikit/components/Text";
import { Textfield } from "@moysklad/uikit/components/Textfield";
import { VStack } from "@moysklad/uikit/components/VStack";
import {
  POPUP_DEFAULT_ACTIVE_TAB,
  POPUP_DEFAULT_DIALOG_BUTTONS,
  POPUP_DEFAULT_DIALOG_TEXT,
  POPUP_DEFAULT_NAME,
  POPUP_DEFAULT_NAVIGATE_PATH,
  POPUP_DEFAULT_PARAMS,
} from "../lib/demo-defaults";
import { PopupActionRow, PopupSection } from "./PopupLayout";

type Props = {
  onSelectFolder: () => Promise<void>;
  onNavigate: (path: string) => Promise<void>;
  onShowDialog: (dialogText: string, dialogButtons: string) => Promise<void>;
  onShowPopup: (popupName: string, popupParams: string) => Promise<void>;
  onClosePopup: () => void;
};

export const PopupActionsPanel = (props: Props) => {
  const { onSelectFolder, onNavigate, onShowDialog, onShowPopup, onClosePopup } = props;

  const [activeTab, setActiveTab] = useState(POPUP_DEFAULT_ACTIVE_TAB);
  const [navigatePath, setNavigatePath] = useState(POPUP_DEFAULT_NAVIGATE_PATH);
  const [dialogText, setDialogText] = useState(POPUP_DEFAULT_DIALOG_TEXT);
  const [dialogButtons, setDialogButtons] = useState(POPUP_DEFAULT_DIALOG_BUTTONS);
  const [popupName, setPopupName] = useState(POPUP_DEFAULT_NAME);
  const [popupParams, setPopupParams] = useState(POPUP_DEFAULT_PARAMS);

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
          <PopupSection>
            <Text.H4>Выбор группы товаров</Text.H4>
            <div>
              <Button type="button" variant="primary" onClick={() => void onSelectFolder()}>
                Выбрать
              </Button>
            </div>
          </PopupSection>
        ) : null}

        {activeTab === "navigation" ? (
          <PopupSection>
            <Text.H4>Навигация</Text.H4>
            <Input
              name="popupNavigatePath"
              label="Путь"
              value={navigatePath}
              onChange={(event) => setNavigatePath(event.target.value)}
            />
            <div>
              <Button type="button" variant="primary" onClick={() => void onNavigate(navigatePath.trim() || "/")}>
                Перейти
              </Button>
            </div>
          </PopupSection>
        ) : null}

        {activeTab === "dialogs" ? (
          <PopupSection>
            <Text.H4>Диалог</Text.H4>
            <Input
              name="popupDialogText"
              label="Текст диалога"
              value={dialogText}
              onChange={(event) => setDialogText(event.target.value)}
            />
            <Textfield
              name="popupDialogButtons"
              label="Кнопки диалога (JSON)"
              value={dialogButtons}
              onChange={(event) => setDialogButtons(event.target.value)}
              rows={5}
            />
            <div>
              <Button
                type="button"
                variant="primary"
                onClick={() => void onShowDialog(dialogText.trim() || "Dialog", dialogButtons)}
              >
                Открыть
              </Button>
            </div>
          </PopupSection>
        ) : null}

        {activeTab === "popups" ? (
          <PopupSection>
            <Text.H4>Popup</Text.H4>
            <Input
              name="popupName"
              label="Название попапа"
              value={popupName}
              onChange={(event) => setPopupName(event.target.value)}
            />
            <Textfield
              name="popupParams"
              label="Параметры попапа (JSON)"
              value={popupParams}
              onChange={(event) => setPopupParams(event.target.value)}
              rows={5}
            />
            <PopupActionRow>
              <Button
                type="button"
                variant="primary"
                onClick={() => void onShowPopup(popupName.trim() || "popup", popupParams)}
              >
                Открыть
              </Button>
              <Button type="button" variant="secondary" onClick={onClosePopup}>
                Закрыть
              </Button>
            </PopupActionRow>
          </PopupSection>
        ) : null}
      </VStack>
    </section>
  );
};
