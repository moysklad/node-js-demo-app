import { useState } from "react";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { WidgetContext } from "../types";
import { WidgetActionPanel } from "./WidgetActionPanel";
import { WidgetScrollBody, WidgetSection, WidgetSectionDivider } from "./WidgetLayout";

type Props = {
  context: WidgetContext | null;
  contextError: string;
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
    contextError,
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
    <section className="card card--widget">
      <VStack size="s12" style={{ flex: "1 1 auto", minHeight: 0 }}>
        <WidgetScrollBody>
          <VStack size="s12">
            <WidgetSection padding="0 0 12px">
              <Text.BodyStrong>Текущий пользователь</Text.BodyStrong>
              {context ? (
                <Text.Body>
                  {context.uid} ({context.fio})
                </Text.Body>
              ) : null}
              {!context && !contextError ? <Text.Body>Загрузка bootstrap-контекста...</Text.Body> : null}
              {contextError ? <Text.Body>{contextError}</Text.Body> : null}
              <Text.Body>Открытый объект: {objectLabel}</Text.Body>
            </WidgetSection>

            <WidgetSectionDivider />

            <WidgetSection>
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
            </WidgetSection>
          </VStack>
        </WidgetScrollBody>
      </VStack>
    </section>
  );
}
