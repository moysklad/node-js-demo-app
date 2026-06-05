import { Button } from "@moysklad/uikit/components/Button";
import { Input } from "@moysklad/uikit/components/Input";
import { Text } from "@moysklad/uikit/components/Text";
import { Textfield } from "@moysklad/uikit/components/Textfield";

type Values = {
  navigatePath: string;
  dialogText: string;
  dialogButtons: string;
  validationPayload: string;
  updatePayload: string;
};

type Setters = {
  onNavigatePathChange: (value: string) => void;
  onDialogTextChange: (value: string) => void;
  onDialogButtonsChange: (value: string) => void;
  onValidationPayloadChange: (value: string) => void;
  onUpdatePayloadChange: (value: string) => void;
};

type Actions = {
  onSelectFolder: () => Promise<void>;
  onNavigate: () => Promise<void>;
  onShowDialog: () => Promise<void>;
  onSetDirty: () => void;
  onClearDirty: () => void;
  onValidationFeedback: () => void;
  onUpdate: () => Promise<void>;
  onShowPopup: () => Promise<void>;
  onClosePopup: () => void;
};

type Props = {
  values: Values;
  setters: Setters;
  actions: Actions;
};

export function WidgetActionPanel(props: Props) {
  const {
    values: { navigatePath, dialogText, dialogButtons, validationPayload, updatePayload },
    setters: {
      onNavigatePathChange,
      onDialogTextChange,
      onDialogButtonsChange,
      onValidationPayloadChange,
      onUpdatePayloadChange,
    },
    actions: {
      onSelectFolder,
      onNavigate,
      onShowDialog,
      onSetDirty,
      onClearDirty,
      onValidationFeedback,
      onUpdate,
      onShowPopup,
      onClosePopup,
    },
  } = props;

  return (
    <div className="widget-sections">
      <section className="widget-section">
        <Text.BodyStrong>Выбор группы товаров</Text.BodyStrong>
        <div>
          <Button type="button" variant="primary" onClick={() => void onSelectFolder()}>
            Выбрать
          </Button>
        </div>
      </section>

      <section className="widget-section">
        <Text.BodyStrong>Навигация</Text.BodyStrong>
        <Input name="navigatePath" label="Путь" value={navigatePath} onChange={(event) => onNavigatePathChange(event.target.value)} />
        <div>
          <Button type="button" variant="primary" onClick={() => void onNavigate()}>
            Перейти
          </Button>
        </div>
      </section>

      <section className="widget-section">
        <Text.BodyStrong>Диалог</Text.BodyStrong>
        <Input name="dialogText" label="Текст диалога" value={dialogText} onChange={(event) => onDialogTextChange(event.target.value)} />
        <Textfield
          name="dialogButtons"
          label="Кнопки диалога (JSON)"
          value={dialogButtons}
          onChange={(event) => onDialogButtonsChange(event.target.value)}
          rows={4}
        />
        <div>
          <Button type="button" variant="primary" onClick={() => void onShowDialog()}>
            Открыть
          </Button>
        </div>
      </section>

      <section className="widget-section">
        <Text.BodyStrong>Dirty State</Text.BodyStrong>
        <div className="row row--actions">
          <Button type="button" variant="primary" onClick={onSetDirty}>
            Установить
          </Button>
          <div>
            <Button type="button" variant="secondary" onClick={onClearDirty}>
              Очистить
            </Button>
          </div>
        </div>
      </section>

      <section className="widget-section">
        <Text.BodyStrong>Validation Feedback</Text.BodyStrong>
        <Textfield
          name="validationPayload"
          label="Параметры валидации (JSON или text)"
          value={validationPayload}
          onChange={(event) => onValidationPayloadChange(event.target.value)}
          rows={4}
        />
        <div>
          <Button type="button" variant="primary" onClick={onValidationFeedback}>
            Подтвердить
          </Button>
        </div>
      </section>

      <section className="widget-section">
        <Text.BodyStrong>Update Provider</Text.BodyStrong>
        <Textfield
          name="updatePayload"
          label="Параметры обновления (JSON или text)"
          value={updatePayload}
          onChange={(event) => onUpdatePayloadChange(event.target.value)}
          rows={3}
        />
        <div>
          <Button type="button" variant="primary" onClick={() => void onUpdate()}>
            Обновить
          </Button>
        </div>
      </section>

      <section className="widget-section">
        <Text.BodyStrong>Popup</Text.BodyStrong>
        <div className="row row--actions">
          <Button type="button" variant="primary" onClick={() => void onShowPopup()}>
            Открыть
          </Button>
          <Button type="button" variant="secondary" onClick={onClosePopup}>
            Закрыть
          </Button>
        </div>
      </section>
    </div>
  );
}
