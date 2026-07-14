import WidgetSDK from "@moysklad/js-widget-sdk";
import "../globals";

const root = document.body;
const vendorApiRequestUrl = root.dataset.vendorApiRequestUrl || "";
const form = document.getElementById("settingsForm") as HTMLFormElement | null;
const result = document.getElementById("settingsResult");
const statusBox = document.getElementById("appStatus");
const statusTitle = document.getElementById("appStatusTitle");
const statusDetails = document.getElementById("appStatusDetails");
const resizeProbe = document.getElementById("resizeProbe");
const probeCount = document.getElementById("probeCount");
const decreaseProbeButton = document.getElementById("btnDecreaseProbe");
const increaseProbeButton = document.getElementById("btnIncreaseProbe");
const loyaltyData = document.getElementById("loyaltyData") as HTMLTextAreaElement | null;
const loyaltyResult = document.getElementById("loyaltyResult");
const loyaltyStatusBox = document.getElementById("loyaltyStatus");
const loyaltyStatusTitle = document.getElementById("loyaltyStatusTitle");
const loyaltyStatusDetails = document.getElementById("loyaltyStatusDetails");
const updatePutButton = document.getElementById("btnUpdatePut");
const updatePatchButton = document.getElementById("btnUpdatePatch");

if (form && result) {
  const resultEl = result as HTMLElement;
  const sdk = WidgetSDK.create({ debug: true }) as any;
  sdk.autoResizeIframe();
  let resizeProbeBlocks = 1;

  const submitButton = form.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton ? submitButton.textContent : "";

  function renderResizeProbe(): void {
    if (!resizeProbe || !probeCount) {
      return;
    }

    probeCount.textContent = String(resizeProbeBlocks);
    resizeProbe.innerHTML = "";

    for (let index = 0; index < resizeProbeBlocks; index += 1) {
      const item = document.createElement("div");
      item.className = "resize-probe__item";

      const title = document.createElement("strong");
      title.className = "resize-probe__item-title";
      title.textContent = `Секция ${index + 1}`;

      const body = document.createElement("div");
      body.textContent =
        "Этот блок нужен для ручной проверки autoResizeIframe. При добавлении секций высота страницы должна меняться сразу.";

      item.append(title, body);
      resizeProbe.append(item);
    }
  }

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

  function setLoyaltyResult(message: string, kind?: "is-success" | "is-error"): void {
    if (!loyaltyResult) {
      return;
    }

    loyaltyResult.textContent = message;
    loyaltyResult.classList.remove("is-success", "is-error");
    if (kind) {
      loyaltyResult.classList.add(kind);
    }
  }

  function updateLoyaltyPreview(value: {
    url?: string;
    token?: string;
    externalSearch?: boolean;
  }): void {
    if (!loyaltyStatusBox || !loyaltyStatusTitle || !loyaltyStatusDetails) {
      return;
    }

    const hasCredentials = Boolean(value.url && value.token);
    loyaltyStatusBox.classList.remove("status-required", "status-ready");
    loyaltyStatusBox.classList.add(hasCredentials ? "status-ready" : "status-required");
    loyaltyStatusTitle.textContent = hasCredentials ? "НАСТРОЕНО" : "ТРЕБУЕТСЯ НАСТРОЙКА";
    loyaltyStatusDetails.innerHTML = "";
    loyaltyStatusDetails.append(
      "Подключение: ",
      hasCredentials ? "настроено" : "не настроено",
      document.createElement("br"),
      "Токен: ",
      value.token ? "настроен" : "не задан",
      document.createElement("br"),
      "Внешние покупатели: ",
      value.externalSearch ? "да" : "нет"
    );
  }

  async function updateLoyalty(method: "PUT" | "PATCH"): Promise<void> {
    if (!loyaltyData) {
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(loyaltyData.value) as Record<string, unknown>;
    } catch {
      setLoyaltyResult("Невалидный JSON в loyalty data", "is-error");
      return;
    }

    setLoyaltyResult("Сохранение...");
    try {
      const response = await fetch(`${vendorApiRequestUrl}/loyalty`, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { message?: string; loyalty?: { url?: string; token?: string; externalSearch?: boolean } };

      if (!response.ok) {
        setLoyaltyResult(result.message || "Не удалось сохранить настройки loyalty", "is-error");
        return;
      }

      const saved = result.loyalty || {};
      loyaltyData.value = JSON.stringify({
        url: saved.url || "",
        token: saved.token || "",
        externalSearch: Boolean(saved.externalSearch)
      }, null, 2);
      updateLoyaltyPreview(saved);
      setLoyaltyResult(result.message || "Настройки loyalty обновлены", "is-success");
    } catch {
      setLoyaltyResult("Не удалось сохранить настройки loyalty", "is-error");
    }
  }

  decreaseProbeButton?.addEventListener("click", () => {
    resizeProbeBlocks = Math.max(1, resizeProbeBlocks - 1);
    renderResizeProbe();
  });

  increaseProbeButton?.addEventListener("click", () => {
    resizeProbeBlocks += 1;
    renderResizeProbe();
  });

  renderResizeProbe();

  if (loyaltyData) {
    try {
      const value = JSON.parse(loyaltyData.value) as { url?: string; token?: string; externalSearch?: boolean };
      updateLoyaltyPreview(value);
    } catch {
      setLoyaltyResult("Невалидный JSON в loyalty data", "is-error");
    }
  }

  updatePutButton?.addEventListener("click", () => updateLoyalty("PUT"));
  updatePatchButton?.addEventListener("click", () => updateLoyalty("PATCH"));

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
