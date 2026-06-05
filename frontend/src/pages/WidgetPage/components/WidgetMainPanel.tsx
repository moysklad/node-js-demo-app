import { useState } from "react";
import { Text } from "@moysklad/uikit/components/Text";
import { VStack } from "@moysklad/uikit/components/VStack";
import type { WidgetContext } from "../types";
import {
  WIDGET_DEFAULT_DIALOG_BUTTONS,
  WIDGET_DEFAULT_DIALOG_TEXT,
  WIDGET_DEFAULT_NAVIGATE_PATH,
  WIDGET_DEFAULT_UPDATE_PAYLOAD,
  WIDGET_DEFAULT_VALIDATION_PAYLOAD,
} from "../lib/demo-defaults";
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

export const WidgetMainPanel = (props: Props) => {
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

  const [navigatePath, setNavigatePath] = useState(WIDGET_DEFAULT_NAVIGATE_PATH);
  const [dialogText, setDialogText] = useState(WIDGET_DEFAULT_DIALOG_TEXT);
  const [dialogButtons, setDialogButtons] = useState(WIDGET_DEFAULT_DIALOG_BUTTONS);
  const [validationPayload, setValidationPayload] = useState(WIDGET_DEFAULT_VALIDATION_PAYLOAD);
  const [updatePayload, setUpdatePayload] = useState(WIDGET_DEFAULT_UPDATE_PAYLOAD);

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
};
