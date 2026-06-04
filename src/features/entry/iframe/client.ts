import WidgetSDK from "@moysklad/js-widget-sdk";
import "../globals";

const form = document.getElementById("settingsForm") as HTMLFormElement | null;
const result = document.getElementById("settingsResult");
const statusBox = document.getElementById("appStatus");
const statusTitle = document.getElementById("appStatusTitle");
const statusDetails = document.getElementById("appStatusDetails");

if (form && result) {
  const resultEl = result as HTMLElement;
  const sdk = WidgetSDK.create({ debug: true }) as any;
  sdk.autoResizeIframe();

  const submitButton = form.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton ? submitButton.textContent : "";

  function setResult(message: string, kind?: "is-success" | "is-error"): void {
    resultEl.textContent = message;
    resultEl.classList.remove("is-success", "is-error");

    if (kind) {
      resultEl.classList.add(kind);
    }
  }

  function updateStatus(status: { className?: string; title?: string; showDetails?: boolean; infoMessage?: string; store?: string } | null): void {
    if (!status || !statusBox || !statusTitle || !statusDetails) {
      return;
    }

    statusBox.classList.remove("status-required", "status-ready");

    if (status.className) {
      statusBox.classList.add(status.className);
    }

    statusTitle.textContent = status.title || "";

    if (status.showDetails) {
      statusDetails.hidden = false;
      statusDetails.innerHTML = "";
      statusDetails.append("Сообщение: ", status.infoMessage || "", document.createElement("br"), "Выбран склад: ", status.store || "");
    } else {
      statusDetails.hidden = true;
      statusDetails.textContent = "";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setResult("", undefined);

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = "Сохранение...";
    }

    try {
      const response = await fetch(form.dataset.updateUrl || form.action, {
        method: "POST",
        body: new URLSearchParams(new FormData(form) as any),
        credentials: "same-origin",
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();
      const message = typeof payload === "string" ? payload : payload.message;

      if (response.ok) {
        setResult(message || "Настройки обновлены", "is-success");
        updateStatus(typeof payload === "string" ? null : payload.status);
      } else {
        setResult(message || "Не удалось сохранить настройки", "is-error");
      }
    } catch {
      setResult("Не удалось сохранить настройки", "is-error");
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    }
  });
}
