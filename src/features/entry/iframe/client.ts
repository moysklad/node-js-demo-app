import WidgetSDK from "@moysklad/js-widget-sdk";
import "../globals";

type UserContextPayload = {
  user: {
    accountId: string;
    userId: string;
    userUid: string;
    role: "admin" | "cashier" | "worker" | "individual";
    isAdmin: boolean;
  };
  contextNonce: string;
  app: {
    infoMessage: string;
    store: string;
    isSettingsRequired: boolean;
    storesValues: string[];
  };
};

const sdk = WidgetSDK.create({ debug: true }) as ReturnType<typeof WidgetSDK.create> & {
  requestUserContextToken(): Promise<string>;
};
sdk.autoResizeIframe();

const form = document.getElementById("settingsForm") as HTMLFormElement | null;
const result = document.getElementById("settingsResult");
const statusBox = document.getElementById("appStatus");
const statusTitle = document.getElementById("appStatusTitle");
const statusDetails = document.getElementById("appStatusDetails");
const resizeProbe = document.getElementById("resizeProbe");
const probeCount = document.getElementById("probeCount");
const decreaseProbeButton = document.getElementById("btnDecreaseProbe");
const increaseProbeButton = document.getElementById("btnIncreaseProbe");

if (document.body.dataset.awaitingUserContext === "true") {
  void initializeUserContext();
}

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

async function initializeUserContext(attempt = 1): Promise<void> {
  const status = document.getElementById("userContextBootstrap");
  const endpoint = document.body.dataset.userContextUrl;

  if (!status || !endpoint) {
    return;
  }

  status.textContent = "Получаем контекст пользователя…";
  status.classList.remove("is-error");

  let token: string | null = null;

  try {
    token = await sdk.requestUserContextToken();
  } catch {
    if (attempt < 15) {
      status.textContent = "Ожидаем готовности хоста…";
      window.setTimeout(() => void initializeUserContext(attempt + 1), 600);
      return;
    }

    status.textContent = "Не удалось запросить контекст пользователя у хоста.";
    status.classList.add("is-error");
    return;
  }

  const request = new Request(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    credentials: "same-origin"
  });
  token = null;

  try {
    const response = await fetch(request);
    const payload = await response.json().catch(() => null) as UserContextPayload | {
      message?: string;
      code?: string;
    } | null;

    if (!response.ok || !isUserContextPayload(payload)) {
      const code = payload && "code" in payload && payload.code ? ` (код ${payload.code})` : "";
      status.textContent = `Не удалось получить контекст пользователя: HTTP ${response.status}${code}.`;
      status.classList.add("is-error");
      return;
    }

    applyUserContext(payload);
    status.hidden = true;
    document.getElementById("iframeContent")?.removeAttribute("hidden");
  } catch {
    status.textContent = "Не удалось отправить контекст на сервер приложения.";
    status.classList.add("is-error");
  }
}

function isUserContextPayload(value: unknown): value is UserContextPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<UserContextPayload>;
  return Boolean(payload.user?.accountId && payload.user.userId && payload.user.userUid && payload.contextNonce && payload.app);
}

function applyUserContext(payload: UserContextPayload): void {
  setText("currentUser", `${payload.user.userUid} (${payload.user.userId})`);
  setText("currentAccount", payload.user.accountId);
  setText("currentRole", roleLabel(payload.user.role));

  const contextNonce = document.querySelector<HTMLInputElement>('input[name="contextNonce"]');
  const infoMessage = document.getElementById("infoMessage") as HTMLInputElement | null;
  const store = document.getElementById("store") as HTMLSelectElement | null;
  const forbidden = document.getElementById("settingsForbidden");

  if (contextNonce) {
    contextNonce.value = payload.contextNonce;
  }
  if (infoMessage) {
    infoMessage.value = payload.app.infoMessage;
  }
  if (store) {
    store.replaceChildren(
      ...payload.app.storesValues.map((value) => new Option(value, value, false, value === payload.app.store))
    );
    if (payload.app.store && !payload.app.storesValues.includes(payload.app.store)) {
      store.prepend(new Option(payload.app.store, payload.app.store, true, true));
    }
  }

  if (form) {
    form.hidden = !payload.user.isAdmin;
  }
  if (forbidden) {
    forbidden.hidden = payload.user.isAdmin;
  }

  updateInitialAppStatus(payload.app);
}

function updateInitialAppStatus(app: UserContextPayload["app"]): void {
  if (!statusBox || !statusTitle || !statusDetails) {
    return;
  }

  statusBox.classList.toggle("status-required", app.isSettingsRequired);
  statusBox.classList.toggle("status-ready", !app.isSettingsRequired);
  statusTitle.textContent = app.isSettingsRequired ? "ТРЕБУЕТСЯ НАСТРОЙКА" : "РЕШЕНИЕ ГОТОВО К РАБОТЕ";
  statusDetails.hidden = app.isSettingsRequired;
  statusDetails.replaceChildren(
    "Сообщение: ",
    app.infoMessage,
    document.createElement("br"),
    "Выбран склад: ",
    app.store
  );
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function roleLabel(role: UserContextPayload["user"]["role"]): string {
  switch (role) {
    case "admin":
      return "администратор аккаунта";
    case "cashier":
      return "кассир";
    case "individual":
      return "индивидуальный аккаунт (без прав администратора)";
    default:
      return "сотрудник";
  }
}
