import WidgetSDK, { type WidgetSDKInstance } from "@moysklad/js-widget-sdk";
import "../globals";

const sdk = WidgetSDK.create({ debug: true });
sdk.autoResizeIframe();

initUserContextPanel(sdk);

const form = document.getElementById("settingsForm") as HTMLFormElement | null;
const result = document.getElementById("settingsResult");
const statusBox = document.getElementById("appStatus");
const statusTitle = document.getElementById("appStatusTitle");
const statusDetails = document.getElementById("appStatusDetails");
const resizeProbe = document.getElementById("resizeProbe");
const probeCount = document.getElementById("probeCount");
const decreaseProbeButton = document.getElementById("btnDecreaseProbe");
const increaseProbeButton = document.getElementById("btnIncreaseProbe");

if (form && result) {
  const resultEl = result as HTMLElement;
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

  decreaseProbeButton?.addEventListener("click", () => {
    resizeProbeBlocks = Math.max(1, resizeProbeBlocks - 1);
    renderResizeProbe();
  });

  increaseProbeButton?.addEventListener("click", () => {
    resizeProbeBlocks += 1;
    renderResizeProbe();
  });

  renderResizeProbe();

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

// UserContext2: виджет сам запрашивает у хоста одноразовый opaque-токен через SDK
// и обменивает его на бэкенде на контекст пользователя (краткий или расширенный).
// В бою поток запускается на загрузке страницы, а кнопки ниже — только чтобы прогнать его повторно.
function initUserContextPanel(sdk: WidgetSDKInstance): void {
  const tokenInput = document.getElementById("uc-token") as HTMLInputElement | null;
  const exchangeUserButton = document.getElementById("uc-exchange-user-btn");
  const exchangeExpandButton = document.getElementById("uc-exchange-expand-btn");
  const statusEl = document.getElementById("uc-status");
  const resultEl = document.getElementById("uc-result");

  if (!tokenInput || !exchangeUserButton || !exchangeExpandButton || !statusEl || !resultEl) {
    return;
  }

  function setStatus(text: string, kind?: "is-success" | "is-error"): void {
    statusEl!.textContent = text;
    statusEl!.classList.remove("is-success", "is-error");

    if (kind) {
      statusEl!.classList.add(kind);
    }
  }

  // Токен одноразовый, поэтому запрос токена и его обмен — единый шаг: на каждый прогон берём новый токен.
  async function runFlow(mode: "user" | "expand"): Promise<void> {
    resultEl!.textContent = "";
    setStatus("Запрашиваем у хоста одноразовый токен...");

    let token: string;

    try {
      token = await sdk.requestUserContextToken();
      tokenInput!.value = token;
    } catch (error) {
      tokenInput!.value = "";
      setStatus(`Не удалось получить токен: ${error instanceof Error ? error.message : String(error)}`, "is-error");
      return;
    }

    setStatus(`Обмениваем токен на бэкенде (${mode})...`);

    try {
      const response = await fetch("/entry/user-context/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mode }),
        credentials: "same-origin"
      });
      const payload = await response.json().catch(() => null);

      if (response.ok) {
        setStatus(`Контекст получен (${mode})`, "is-success");
      } else {
        const code = payload && payload.code ? ` (код Zeus _${payload.code})` : "";
        setStatus(`Обмен отклонён: HTTP ${response.status}${code}`, "is-error");
      }

      resultEl!.textContent = payload ? JSON.stringify(payload, null, 2) : "";
    } catch (error) {
      setStatus(`Ошибка запроса: ${error instanceof Error ? error.message : String(error)}`, "is-error");
    }
  }

  exchangeUserButton.addEventListener("click", () => runFlow("user"));
  exchangeExpandButton.addEventListener("click", () => runFlow("expand"));

  // Нормальный сценарий виджета: сразу на загрузке получаем контекст и поднимаем сессию (expand).
  void runFlow("expand");
}
