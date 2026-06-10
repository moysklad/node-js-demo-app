import WidgetSDK from "@moysklad/js-widget-sdk";
import "../globals";
import { logToPanel, parseMaybeJson } from "../shared";

const logEl = document.getElementById("log");
const widgetLog = (label: string, payload?: unknown): void => logToPanel(logEl, label, payload);
const sdk = WidgetSDK.create({ debug: true }) as any;

window.widgetLog = widgetLog;
window.widgetSdk = sdk;

const tabs = Array.from(document.querySelectorAll<HTMLElement>(".tab"));
const panels = Array.from(document.querySelectorAll<HTMLElement>(".tab-panel"));

function setActiveTab(tabId: string | undefined): void {
  if (!tabId) {
    return;
  }

  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === tabId;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === tabId);
  });
}

tabs.forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));

widgetLog("SDK initialized", { debug: true });
sdk.autoResizeIframe();
sdk.onOpen((message: any) => widgetLog("Event: Open", message));
sdk.onOpenPopup((message: any) => widgetLog("Event: OpenPopup", message));

document.getElementById("btnSelectFolder")?.addEventListener("click", async () => {
  try {
    widgetLog("selectGoodFolder response", await sdk.selectGoodFolder());
  } catch (error: unknown) {
    widgetLog("selectGoodFolder error", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Error",
    });
  }
});

document.getElementById("btnNavigate")?.addEventListener("click", async () => {
  const path = (document.getElementById("navigatePath") as HTMLInputElement | null)?.value.trim() || "/";

  try {
    widgetLog("navigateTo response", await sdk.navigateTo(path, "blank"));
  } catch (error: unknown) {
    widgetLog("navigateTo error", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Error",
    });
  }
});

document.getElementById("btnDialog")?.addEventListener("click", async () => {
  const text = (document.getElementById("dialogText") as HTMLInputElement | null)?.value.trim() || "Dialog";
  const buttonsPayload = parseMaybeJson((document.getElementById("dialogButtons") as HTMLTextAreaElement | null)?.value);

  try {
    const normalizedButtons = Array.isArray(buttonsPayload)
      ? buttonsPayload
      : buttonsPayload && Array.isArray((buttonsPayload as { buttons?: unknown }).buttons)
        ? (buttonsPayload as { buttons: unknown[] }).buttons
        : undefined;

    widgetLog("showDialog response", await sdk.showDialog(text, normalizedButtons as any));
  } catch (error: unknown) {
    widgetLog("showDialog error", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Error",
    });
  }
});

document.getElementById("btnShowPopup")?.addEventListener("click", async () => {
  try {
    const name = (document.getElementById("popupName") as HTMLInputElement | null)?.value.trim() || "popup";
    const params = parseMaybeJson((document.getElementById("popupParams") as HTMLTextAreaElement | null)?.value);
    widgetLog("showPopup response", await sdk.showPopup(name, params as any));
  } catch (error: unknown) {
    widgetLog("showPopup error", { message: error instanceof Error ? error.message : String(error) });
  }
});

document.getElementById("btnClosePopup")?.addEventListener("click", () => {
  widgetLog("closePopup sent", sdk.closePopup({ ok: true }));
});
