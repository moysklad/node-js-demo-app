import { useState } from "react";
import { Button, ButtonVariants } from "@moysklad/uikit/components/Button";
import { HStack } from "@moysklad/uikit/components/HStack";
import { Input } from "@moysklad/uikit/components/Input";
import { Text } from "@moysklad/uikit/components/Text";
import { Textfield } from "@moysklad/uikit/components/Textfield";
import { VStack } from "@moysklad/uikit/components/VStack";
import { describeError, parseMaybeJson } from "./log";
import { sdk } from "./sdk";

type Log = (label: string, payload?: unknown) => void;

/** Методы JS Widget SDK, доступные и виджету, и попапу. Каждая секция — самостоятельный пример вызова. */

export function GoodFolderSection({ log }: { log: Log }) {
  async function select(): Promise<void> {
    try {
      log("selectGoodFolder response", await sdk.selectGoodFolder());
    } catch (error) {
      log("selectGoodFolder error", describeError(error));
    }
  }

  return (
    <VStack size="s8">
      <Text.H3>good-folder-selector</Text.H3>
      <div>
        <Button variant={ButtonVariants.SECONDARY} onClick={select}>
          Выбрать
        </Button>
      </div>
    </VStack>
  );
}

export function NavigationSection({ log }: { log: Log }) {
  const [path, setPath] = useState("#customerorder?sort=o.moment%20d");

  async function navigate(): Promise<void> {
    try {
      log("navigateTo response", await sdk.navigateTo(path.trim() || "/", "blank"));
    } catch (error) {
      log("navigateTo error", describeError(error));
    }
  }

  return (
    <VStack size="s8">
      <Text.H3>navigation-service</Text.H3>
      <Input name="navigatePath" label="Путь" value={path} onChange={(e) => setPath(e.target.value)} />
      <div>
        <Button variant={ButtonVariants.SECONDARY} onClick={navigate}>
          Перейти
        </Button>
      </div>
    </VStack>
  );
}

export function DialogSection({ log }: { log: Log }) {
  const [text, setText] = useState("Hello from SDK");
  const [buttons, setButtons] = useState('[{ "name": "Yes", "caption": "Да, удалить" },{ "name": "No", "caption": "Нет" }]');

  async function open(): Promise<void> {
    const payload = parseMaybeJson(buttons);
    const normalizedButtons = Array.isArray(payload)
      ? payload
      : payload && Array.isArray((payload as { buttons?: unknown }).buttons)
        ? (payload as { buttons: unknown[] }).buttons
        : undefined;

    try {
      log("showDialog response", await sdk.showDialog(text.trim() || "Dialog", normalizedButtons as any));
    } catch (error) {
      log("showDialog error", describeError(error));
    }
  }

  return (
    <VStack size="s8">
      <Text.H3>standard-dialogs</Text.H3>
      <Input name="dialogText" label="Текст диалога" value={text} onChange={(e) => setText(e.target.value)} />
      <Textfield name="dialogButtons" label="Кнопки диалога (JSON)" value={buttons} onChange={(e) => setButtons(e.target.value)} />
      <div>
        <Button variant={ButtonVariants.SECONDARY} onClick={open}>
          Открыть
        </Button>
      </div>
    </VStack>
  );
}

export function PopupSection({ log }: { log: Log }) {
  const [name, setName] = useState("some-popup");
  const [params, setParams] = useState('{ "foo": "bar" }');

  async function show(): Promise<void> {
    try {
      log("showPopup response", await sdk.showPopup(name.trim() || "popup", parseMaybeJson(params) as any));
    } catch (error) {
      log("showPopup error", describeError(error));
    }
  }

  return (
    <VStack size="s8">
      <Text.H3>Popups</Text.H3>
      <Input name="popupName" label="Название попапа" value={name} onChange={(e) => setName(e.target.value)} />
      <Textfield name="popupParams" label="Параметры попапа (JSON)" value={params} onChange={(e) => setParams(e.target.value)} />
      <div>
        <Button variant={ButtonVariants.SECONDARY} onClick={show}>
          Открыть
        </Button>
      </div>
    </VStack>
  );
}

/**
 * Закрытие попапа изнутри: ClosePopup с popupResponse, который хост вернет виджету в ShowPopupResponse.
 * Открыть другой попап из попапа нельзя — ShowPopupRequest принимается только от виджета, главного iframe и кнопок.
 */
export function ClosePopupSection({ log }: { log: Log }) {
  const [response, setResponse] = useState('{ "ok": true }');

  return (
    <VStack size="s8">
      <Text.H3>closePopup</Text.H3>
      <Textfield name="popupResponse" label="Ответ виджету (popupResponse, JSON)" value={response} onChange={(e) => setResponse(e.target.value)} />
      <div>
        <Button variant={ButtonVariants.SECONDARY} onClick={() => log("closePopup sent", sdk.closePopup(parseMaybeJson(response) as any))}>
          Закрыть попап
        </Button>
      </div>
    </VStack>
  );
}
