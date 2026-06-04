import WidgetSDK from "@moysklad/js-widget-sdk";
import "../globals";
import { logToPanel, parseMaybeJson } from "../shared";

const root = document.body;
const logEl = document.getElementById("log");
const getObjectUrl = root ? root.dataset.getObjectUrl || "" : "";
const objectEl = document.getElementById("object");
const widgetLog = (label: string, payload?: unknown): void => logToPanel(logEl, label, payload);
const sdk = WidgetSDK.create({ debug: true }) as any;
const AUTO_OPEN_FEEDBACK_DELAY_MS = 1000;
const sdkControlIds = ["btnSelectFolder", "btnNavigate", "btnDialog", "btnSetDirty", "btnClearDirty", "btnValidation", "btnUpdate", "btnShowPopup", "btnClosePopup"];
let objectState: Record<string, unknown> = {};

window.widgetLog = widgetLog;
window.widgetSdk = sdk;

function setSdkControlsEnabled(enabled: boolean): void {
  for (const id of sdkControlIds) {
    const el = document.getElementById(id);

    if (!el) {
      continue;
    }

    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.disabled = !enabled;
    }

    if (enabled) {
      el.removeAttribute("title");
      el.removeAttribute("aria-disabled");
    } else {
      el.setAttribute("title", "SDK недоступен");
      el.setAttribute("aria-disabled", "true");
    }
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (left && right && typeof left === "object" && typeof right === "object") {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  return false;
}

function diffState(oldState: Record<string, unknown>, newState: Record<string, unknown>): Map<string, unknown> {
  const result = new Map<string, unknown>();

  for (const key in newState) {
    const hasOldValue = Object.prototype.hasOwnProperty.call(oldState, key);
    const oldValue = hasOldValue ? oldState[key] : undefined;

    if (!hasOldValue || !valuesEqual(newState[key], oldValue)) {
      result.set(key, newState[key]);
    }
  }

  for (const key in oldState) {
    if (!Object.prototype.hasOwnProperty.call(newState, key)) {
      result.set(key, "<deleted>");
    }
  }

  return result;
}

function formatDiffs(map: Map<string, unknown>): string {
  if (map.size === 0) {
    return "objectState: no changes";
  }

  const lines: string[] = [];

  map.forEach((value, key) => {
    lines.push(value && typeof value === "object" ? `${key} = {...}` : `${key} = ${String(value)}`);
  });

  return `objectState changes:\n${lines.join("\n")}`;
}

widgetLog("SDK initialized", { debug: true });
setSdkControlsEnabled(true);

sdk.onOpen((message: any) => {
  widgetLog("Event: Open", message);

  const resolvedId = message == null ? undefined : message.messageId;
  setTimeout(() => {
    widgetLog("auto openFeedback sent", sdk.openFeedback(resolvedId as any));
  }, AUTO_OPEN_FEEDBACK_DELAY_MS);

  if (objectEl && getObjectUrl && message && message.objectId) {
    fetch(getObjectUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contextNonce: root.dataset.contextNonce || "",
        objectId: message.objectId,
      }),
    })
      .then(async (response) => {
        const text = await response.text();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        return text;
      })
      .then((text) => {
        objectEl.textContent = text;
      })
      .catch((error: unknown) => {
        widgetLog("object fetch error", { message: error instanceof Error ? error.message : String(error) });
      });
  } else if (!message || !message.objectId) {
    widgetLog("object fetch skipped", { reason: "missing objectId" });
  }
});

sdk.onOpenPopup((message: any) => widgetLog("Event: OpenPopup", message));
sdk.onChange((message: any) => {
  widgetLog("Event: Change", message);

  if (!message || !message.objectState) {
    widgetLog("Change ignored", { reason: "missing objectState" });
    return;
  }

  const nextState = message.objectState as Record<string, unknown>;
  widgetLog("Event: Change (diff)", formatDiffs(diffState(objectState, nextState)));
  objectState = nextState;
});
sdk.onSave((message: any) => widgetLog("Event: Save", message));

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

document.getElementById("btnSetDirty")?.addEventListener("click", () => {
  widgetLog("setDirty sent", sdk.setDirty());
});

document.getElementById("btnClearDirty")?.addEventListener("click", () => {
  widgetLog("clearDirty sent", sdk.clearDirty());
});

document.getElementById("btnValidation")?.addEventListener("click", () => {
  const payload = parseMaybeJson((document.getElementById("validationPayload") as HTMLTextAreaElement | null)?.value);
  const valid = payload && typeof payload === "object" && (payload as { valid?: unknown }).valid !== undefined ? Boolean((payload as { valid?: unknown }).valid) : false;
  const message = payload && typeof payload === "object" && (payload as { message?: unknown }).message !== undefined ? String((payload as { message?: unknown }).message) : undefined;
  const correlationId = payload && typeof payload === "object" && (payload as { correlationId?: unknown; changeMessageId?: unknown }).correlationId !== undefined
    ? (payload as { correlationId?: unknown }).correlationId
    : payload && typeof payload === "object" && (payload as { changeMessageId?: unknown }).changeMessageId !== undefined
      ? (payload as { changeMessageId?: unknown }).changeMessageId
      : undefined;

  widgetLog("validationFeedback sent", sdk.validationFeedback(valid, message, correlationId as any));
});

document.getElementById("btnUpdate")?.addEventListener("click", async () => {
  try {
    const payload = parseMaybeJson((document.getElementById("updatePayload") as HTMLTextAreaElement | null)?.value);
    widgetLog("update response", await sdk.update(payload as any));
  } catch (error: unknown) {
    widgetLog("update error", { message: error instanceof Error ? error.message : String(error) });
  }
});

document.getElementById("btnShowPopup")?.addEventListener("click", async () => {
  try {
    widgetLog("showPopup response", await sdk.showPopup("some-popup", { foo: "bar" } as any));
  } catch (error: unknown) {
    widgetLog("showPopup error", { message: error instanceof Error ? error.message : String(error) });
  }
});
