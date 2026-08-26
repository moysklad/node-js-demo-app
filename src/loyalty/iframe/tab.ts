import { readLoyaltyConnectResponse } from "./tab-response";

type LoyaltyConnectionState = {
  className?: string;
  title?: string;
  details?: string;
};

/**
 * Логика вкладки «Программа лояльности».
 * Вынесена из формы настроек, потому что подключение лояльности необязательно
 * и никак не связано с обязательными настройками решения.
 */
export function initLoyaltyTab(): void {
  const openAuthButton = document.getElementById("openAuth") as HTMLButtonElement | null;
  const openManualButton = document.getElementById("openManual") as HTMLButtonElement | null;
  const requestToggle = document.getElementById("requestToggle") as HTMLButtonElement | null;
  const requestExample = document.getElementById("requestExample");
  const exampleEntry = document.getElementById("exampleEntry");
  const showOnboardingButton = document.getElementById("showOnboarding") as HTMLButtonElement | null;
  const hideOnboardingButton = document.getElementById("hideOnboarding") as HTMLButtonElement | null;
  const onboarding = document.getElementById("onboarding");

  const loyaltyStatus = document.getElementById("loyaltyStatus");
  const loyaltyStatusTitle = document.getElementById("loyaltyStatusTitle");
  const loyaltyStatusDetails = document.getElementById("loyaltyStatusDetails");

  const authDialog = document.getElementById("authDialog") as HTMLDialogElement | null;
  const closeAuthButton = document.getElementById("closeAuth") as HTMLButtonElement | null;
  const authForm = document.getElementById("authForm") as HTMLFormElement | null;
  const authResult = document.getElementById("authResult");
  const authSubmit = document.getElementById("authSubmit") as HTMLButtonElement | null;
  const authSubtitle = document.getElementById("authSubtitle");
  const identityText = document.getElementById("identityText");
  const authTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mode]"));
  const finishPreferredButton = document.getElementById("finishPreferred") as HTMLButtonElement | null;
  const backToAuthButton = document.getElementById("backToAuth") as HTMLButtonElement | null;

  const manualDialog = document.getElementById("manualDialog") as HTMLDialogElement | null;
  const closeManualButton = document.getElementById("closeManual") as HTMLButtonElement | null;
  const cancelManualButton = document.getElementById("cancelManual") as HTMLButtonElement | null;
  const manualForm = document.getElementById("manualForm") as HTMLFormElement | null;
  const manualStatus = document.getElementById("manualStatus");
  const manualRequest = document.getElementById("manualRequest") as HTMLPreElement | null;
  const manualFinishActions = document.getElementById("manualFinishActions");
  const finishManualButton = document.getElementById("finishManual") as HTMLButtonElement | null;

  const manualProviderUrl = manualForm?.querySelector<HTMLInputElement>("#providerUrl");
  const authLogin = authForm?.querySelector<HTMLInputElement>("#login");

  let authMode: "login" | "register" = "login";

  requestToggle?.addEventListener("click", () => {
    if (!requestToggle || !requestExample) return;
    const isOpen = requestToggle.getAttribute("aria-expanded") === "true";
    requestToggle.setAttribute("aria-expanded", String(!isOpen));
    requestExample.hidden = isOpen;
    const label = requestToggle.querySelector("span:first-child");
    if (label) {
      label.textContent = isOpen ? "Показать пример запроса" : "Скрыть пример запроса";
    }
  });

  showOnboardingButton?.addEventListener("click", () => {
    if (!onboarding) return;
    if (exampleEntry) {
      exampleEntry.hidden = true;
      exampleEntry.setAttribute("aria-hidden", "true");
    }
    onboarding.hidden = false;
    onboarding.setAttribute("aria-hidden", "false");
    onboarding.classList.add("is-visible");
    onboarding.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  hideOnboardingButton?.addEventListener("click", () => {
    closeAuthDialog();
    closeManualDialog();
    hideOnboarding();
  });

  openAuthButton?.addEventListener("click", () => {
    if (!authDialog || !authForm || !authResult || !authSubmit || !authSubtitle) return;
    authMode = "login";
    syncAuthMode();
    authForm.reset();
    authForm.classList.remove("is-hidden");
    authResult.classList.remove("is-visible");
    authResult.hidden = false;
    openDialog(authDialog);
    authLogin?.focus();
  });

  openManualButton?.addEventListener("click", () => {
    if (!manualDialog || !manualForm || !manualStatus || !manualRequest || !manualFinishActions) return;
    manualForm.reset();
    manualStatus.classList.remove("is-visible");
    manualStatus.textContent = "";
    manualRequest.hidden = true;
    manualRequest.textContent = "";
    manualFinishActions.hidden = true;
    openDialog(manualDialog);
    manualProviderUrl?.focus();
  });

  closeAuthButton?.addEventListener("click", closeAuthDialog);
  closeManualButton?.addEventListener("click", closeManualDialog);
  cancelManualButton?.addEventListener("click", closeManualDialog);

  authDialog?.addEventListener("click", (event) => {
    if (!authDialog.open) return;
    if (isClickOutside(authDialog, event as MouseEvent)) closeAuthDialog();
  });

  manualDialog?.addEventListener("click", (event) => {
    if (!manualDialog.open) return;
    if (isClickOutside(manualDialog, event as MouseEvent)) closeManualDialog();
  });

  for (const tabButton of authTabs) {
    tabButton.addEventListener("click", () => {
      const mode = tabButton.dataset.mode;
      if (mode !== "login" && mode !== "register") return;
      authMode = mode;
      syncAuthMode();
    });
  }

  authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!authForm || !authResult || !authSubmit) return;

    authForm.classList.add("is-hidden");
    authResult.classList.add("is-visible");

    const modeText = authMode === "login" ? "Вход" : "Регистрация";
    if (authSubtitle) {
      authSubtitle.textContent =
        authMode === "login"
          ? "Пользователь вошёл в программу лояльности, после чего провайдер получает нужные настройки."
          : "Пользователь зарегистрирован, после чего провайдер получает нужные настройки.";
    }
    if (identityText) {
      const login = authLogin?.value.trim() || "login";
      identityText.textContent = `Программа лояльности получает login «${login}» и password на своей стороне.`;
    }

    authSubmit.disabled = true;
    authSubmit.textContent = `${modeText} завершён`;
  });

  backToAuthButton?.addEventListener("click", () => {
    if (!authForm || !authResult || !authSubmit) return;
    authForm.classList.remove("is-hidden");
    authResult.classList.remove("is-visible");
    authForm.reset();
    authMode = "login";
    syncAuthMode();
    authSubmit.disabled = false;
  });

  finishPreferredButton?.addEventListener("click", () => {
    closeAuthDialog();
  });

  authForm?.addEventListener("reset", () => {
    authMode = "login";
    syncAuthMode();
  });

  manualForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!manualForm || !manualStatus || !manualRequest || !manualFinishActions || !finishManualButton) return;

    const formData = new FormData(manualForm);
    const providerUrl = String(formData.get("providerUrl") ?? "").trim();
    const providerToken = String(formData.get("providerToken") ?? "").trim();
    const externalSearch = formData.get("externalSearch") === "on";
    const contextNonce = String(formData.get("contextNonce") ?? "");

    manualStatus.classList.remove("is-visible");
    manualStatus.textContent = "Передаем настройки в МойСклад...";
    manualRequest.hidden = true;
    manualFinishActions.hidden = true;

    void fetch("/utils/connect-loyalty", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerUrl, providerToken, externalSearch, contextNonce })
    })
      .then(async (response) => {
        const payload = await readLoyaltyConnectResponse(response);
        const message = typeof payload === "string" ? payload : payload.message;
        if (!response.ok) {
          throw new Error(message || "Не удалось настроить Loyalty API");
        }

        manualStatus.textContent = message || "Loyalty API настроен";
        manualStatus.classList.add("is-visible");
        manualRequest.textContent = formatManualRequest(providerUrl, providerToken, externalSearch);
        manualRequest.hidden = false;
        manualFinishActions.hidden = false;
        updateLoyaltyStatus(typeof payload === "string" ? null : payload.loyalty ?? null);
        finishManualButton.focus();
      })
      .catch((error: unknown) => {
        manualStatus.textContent =
          error instanceof Error ? error.message : "Не удалось настроить Loyalty API";
        manualStatus.classList.add("is-visible");
      });
  });

  finishManualButton?.addEventListener("click", () => {
    closeManualDialog();
  });

  function updateLoyaltyStatus(state: LoyaltyConnectionState | null): void {
    if (!state || !loyaltyStatus || !loyaltyStatusTitle || !loyaltyStatusDetails) {
      return;
    }

    loyaltyStatus.classList.remove("status-required", "status-ready");

    if (state.className) {
      loyaltyStatus.classList.add(state.className);
    }

    loyaltyStatusTitle.textContent = state.title || "";
    loyaltyStatusDetails.textContent = state.details || "";
  }

  function syncAuthMode(): void {
    for (const tabButton of authTabs) {
      const isActive = tabButton.dataset.mode === authMode;
      tabButton.classList.toggle("is-active", isActive);
      tabButton.setAttribute("aria-selected", String(isActive));
    }

    if (authSubtitle) {
      authSubtitle.textContent =
        authMode === "login"
          ? "Войдите или зарегистрируйтесь, чтобы подключить аккаунт к МоемуСкладу."
          : "Зарегистрируйтесь, если аккаунта ещё нет, затем провайдер передаст настройки в МойСклад.";
    }

    if (authSubmit) {
      authSubmit.textContent = authMode === "login" ? "Войти и продолжить" : "Зарегистрироваться и продолжить";
    }
  }

  function closeAuthDialog(): void {
    authDialog?.close();
  }

  function closeManualDialog(): void {
    manualDialog?.close();
  }

  function hideOnboarding(): void {
    if (!onboarding) return;
    onboarding.classList.remove("is-visible");
    onboarding.hidden = true;
    onboarding.setAttribute("aria-hidden", "true");
    if (exampleEntry) {
      exampleEntry.hidden = false;
      exampleEntry.setAttribute("aria-hidden", "false");
      exampleEntry.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.setTimeout(() => showOnboardingButton?.focus(), 250);
  }
}

function formatManualRequest(providerUrl: string, providerToken: string, externalSearch: boolean): string {
  return [
    `PUT https://apps-api.moysklad.ru/api/vendor/1.0/apps/{appId}/{accountId}/loyalty`,
    "",
    "{",
    `  "url": "${providerUrl}",`,
    `  "token": "${providerToken}",`,
    `  "externalSearch": ${String(externalSearch)}`,
    "}"
  ].join("\n");
}

function isClickOutside(dialog: HTMLDialogElement, event: MouseEvent): boolean {
  const bounds = dialog.getBoundingClientRect();

  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  );
}

function openDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }

  dialog.setAttribute("open", "");
  dialog.style.display = "block";
}
