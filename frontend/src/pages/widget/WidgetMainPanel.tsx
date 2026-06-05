import { useState } from "react";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { WidgetContext } from "../../lib/sdk";
import { WidgetActionPanel } from "./WidgetActionPanel";

type Props = {
  context: WidgetContext;
  objectLabel: string;
  onSelectFolder: () => Promise<void>;
  onNavigate: (path: string) => Promise<void>;
  onShowDialog: (dialogText: string, dialogButtons: string) => Promise<void>;
  onSetDirty: () => void;
  onClearDirty: () => void;
  onValidationFeedback: (validationPayload: string) => void;
  onUpdate: (updatePayload: string) => Promise<void>;
  onShowPopup: () => Promise<void>;
  onClosePopup: () => void;
};

export function WidgetMainPanel(props: Props) {
  const {
    context,
    objectLabel,
    onSelectFolder,
    onNavigate,
    onShowDialog,
    onSetDirty,
    onClearDirty,
    onValidationFeedback,
    onUpdate,
    onShowPopup,
    onClosePopup,
  } = props;

  const [navigatePath, setNavigatePath] = useState("#customerorder?sort=o.moment%20d");
  const [dialogText, setDialogText] = useState("Hello from SDK");
  const [dialogButtons, setDialogButtons] = useState(
    '[{ "name": "Yes", "caption": "Да, удалить" },{ "name": "No", "caption": "Нет" }]'
  );
  const [validationPayload, setValidationPayload] = useState(
    '{ "name": "ValidationFeedback", "correlationId": 1, "messageId": 1, "valid": false, "message": "Нужно больше печенья" }'
  );
  const [updatePayload, setUpdatePayload] = useState('{ "name": "1" }');

  return (
    <section className="card card--widget card--widget-main">
      <VStack size="s12" className="widget-card-content">
        <div className="widget-panel__body">
          <div className="widget-sections">
            <section className="widget-section">
              <Text.BodyStrong>Текущий пользователь</Text.BodyStrong>
              <Text.Body>
                {context.uid} ({context.fio})
              </Text.Body>
              <Text.Body>Открытый объект: {objectLabel}</Text.Body>
            </section>

            <section className="widget-section">
              <WidgetActionPanel
                values={{
                  navigatePath,
                  dialogText,
                  dialogButtons,
                  validationPayload,
                  updatePayload,
                }}
                setters={{
                  onNavigatePathChange: setNavigatePath,
                  onDialogTextChange: setDialogText,
                  onDialogButtonsChange: setDialogButtons,
                  onValidationPayloadChange: setValidationPayload,
                  onUpdatePayloadChange: setUpdatePayload,
                }}
                actions={{
                  onSelectFolder,
                  onNavigate: () => onNavigate(navigatePath.trim() || "/"),
                  onShowDialog: () => onShowDialog(dialogText.trim() || "Dialog", dialogButtons),
                  onSetDirty,
                  onClearDirty,
                  onValidationFeedback: () => onValidationFeedback(validationPayload),
                  onUpdate: () => onUpdate(updatePayload),
                  onShowPopup,
                  onClosePopup,
                }}
              />
            </section>
          </div>
        </div>
      </VStack>
    </section>
  );
}
