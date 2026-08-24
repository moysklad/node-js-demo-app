import WidgetSDK from "@moysklad/js-widget-sdk";
import "../globals";
// [feature:loyalty] Логика вкладки «Программа лояльности» живет в срезе src/loyalty.
import { initLoyaltyTab } from "../../../loyalty/iframe/tab";

// SDK, переключение вкладок и проверка авторесайза нужны любому пользователю,
// поэтому инициализируются до формы настроек, доступной только администратору.
const sdk = WidgetSDK.create({ debug: true }) as any;
sdk.autoResizeIframe();

initTabs();
initResizeProbe();
initLoyaltyTab();
initSettingsForm();

function initTabs(): void {
  const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-button[data-tab]"));

  for (const tabButton of tabButtons) {
    tabButton.addEventListener("click", () => {
      const target = tabButton.dataset.tab;

      if (!target) {
        return;
      }

      for (const button of tabButtons) {
        const isActive = button === tabButton;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
      }

      for (const panel of document.querySelectorAll<HTMLElement>(".tab-panel")) {
        const isActive = panel.id === `tab-${target}`;
        panel.classList.toggle("is-active", isActive);
        panel.hidden = !isActive;
      }
    });
  }
}

function initResizeProbe(): void {
  const resizeProbe = document.getElementById("resizeProbe");
  const probeCount = document.getElementById("probeCount");
  const decreaseProbeButton = document.getElementById("btnDecreaseProbe");
  const increaseProbeButton = document.getElementById("btnIncreaseProbe");

  if (!resizeProbe || !probeCount) {
    return;
  }

  let resizeProbeBlocks = 1;

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

  decreaseProbeButton?.addEventListener("click", () => {
    resizeProbeBlocks = Math.max(1, resizeProbeBlocks - 1);
    renderResizeProbe();
  });

  increaseProbeButton?.addEventListener("click", () => {
    resizeProbeBlocks += 1;
    renderResizeProbe();
  });

  renderResizeProbe();
}

function initSettingsForm(): void {
  const form = document.getElementById("settingsForm") as HTMLFormElement | null;
  const result = document.getElementById("settingsResult");
  const statusBox = document.getElementById("appStatus");
  const statusTitle = document.getElementById("appStatusTitle");
  const statusDetails = document.getElementById("appStatusDetails");

  if (!form || !result) {
    return;
  }

  const resultEl = result as HTMLElement;
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
