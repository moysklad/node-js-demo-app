import { useEffect, useState } from "react";
import { Text } from "@moysklad/uikit/components/Text";
import { useSnackbar } from "@moysklad/uikit/components/Snackbar";
import { VStack } from "@moysklad/uikit/components/VStack";
import { useWidgetSdk } from "../../lib/use-widget-sdk";
import { IframeResizeProbe } from "./components/IframeResizeProbe";
import { IframeSettingsPanel } from "./components/IframeSettingsPanel";
import { IframeSummaryPanel } from "./components/IframeSummaryPanel";
import { useIframeContext } from "./hooks/use-iframe-context";
import { useIframeSettings } from "./hooks/use-iframe-settings";

export default function IframePage() {
  const [resizeProbeBlocks, setResizeProbeBlocks] = useState(1);
  const { sdk } = useWidgetSdk(true);
  const { showSnackbar } = useSnackbar();
  const { data, error, setData } = useIframeContext();
  const { draftMessage, draftStore, saveSettings, setDraftMessage, setDraftStore, storeOptions, submitting } =
    useIframeSettings(data, setData, (message, autoHideDuration) => {
      showSnackbar({
        message,
        autoHideDuration,
      });
    });

  useEffect(() => {
    const stopAutoResize = sdk.autoResizeIframe();

    return () => {
      stopAutoResize();
    };
  }, [sdk]);

  if (error) {
    return (
      <main className="shell">
        <VStack size="s4">
          <Text.Body>Ошибка загрузки</Text.Body>
          <Text.Body>{error}</Text.Body>
        </VStack>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell">
        <Text.Body>Загрузка...</Text.Body>
      </main>
    );
  }

  return (
    <main className="shell shell--iframe">
      <IframeSummaryPanel data={data} />
      <IframeSettingsPanel
        data={data}
        draftMessage={draftMessage}
        draftStore={draftStore}
        submitting={submitting}
        storeOptions={storeOptions}
        onDraftMessageChange={setDraftMessage}
        onDraftStoreChange={setDraftStore}
        onSave={saveSettings}
      />
      <IframeResizeProbe
        blocks={resizeProbeBlocks}
        onDecrease={() => setResizeProbeBlocks((current) => Math.max(1, current - 1))}
        onIncrease={() => setResizeProbeBlocks((current) => current + 1)}
      />
    </main>
  );
}
