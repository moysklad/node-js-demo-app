import "../globals";

const form = document.getElementById("loyaltyAccountForm") as HTMLFormElement | null;
const result = document.getElementById("loyaltyResult");
const statusBox = document.getElementById("loyaltyStatus");
const statusTitle = document.getElementById("loyaltyStatusTitle");
const statusDetails = document.getElementById("loyaltyStatusDetails");
const authPanel = document.getElementById("loyaltyAuthPanel");
const infoPanel = document.getElementById("loyaltyInfoPanel");
const settingsPanel = document.getElementById("loyaltySettingsPanel");
const actionResults: Record<string, HTMLElement | null> = {
  search: document.getElementById("loyaltySearchResult"),
  create: document.getElementById("loyaltyCreateResult")
};
const searchInput = document.getElementById("loyaltySearch") as HTMLInputElement | null;
const createName = document.getElementById("loyaltyCreateName") as HTMLInputElement | null;
async function loyaltyAction(action: string): Promise<void> {
  let data: unknown = {};
  if (action === "create") {
    data = { name: createName?.value.trim() };
  }
  const response = await fetch("/entry/loyalty/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, search: searchInput?.value, data }) });
  const payload = await response.json() as { rows?: unknown[]; bonusProgram?: { agentBonusBalance?: number }; error?: string; message?: string; errors?: Array<{ error?: string }> };
  const output = actionResults[action];
  if (!output) return;
  if (!response.ok) { output.textContent = `Ошибка: ${payload.message || payload.error || payload.errors?.[0]?.error || "операция не выполнена"}`; return; }
  output.textContent = action === "search"
    ? `Найдено: ${payload.rows?.length ?? 0}`
    : action === "detail"
      ? `Баланс: ${payload.bonusProgram?.agentBonusBalance ?? 0}`
      : "Контрагент создан";
}
document.getElementById("loyaltySearchButton")?.addEventListener("click", () => void loyaltyAction("search"));
document.getElementById("loyaltyCreateButton")?.addEventListener("click", () => void loyaltyAction("create"));

if (form && result) {
  const currentForm = form;
  const resultElement = result as HTMLElement;

  function setResult(message: string, kind?: "is-success" | "is-error"): void {
    resultElement.textContent = message;
    resultElement.classList.remove("is-success", "is-error");
    if (kind) {
      resultElement.classList.add(kind);
    }
  }

  async function submit(): Promise<void> {
    const formData = new FormData(currentForm);
    const login = String(formData.get("login") ?? "");
    const password = String(formData.get("password") ?? "");
    setResult("Вход...");

    try {
      const response = await fetch("/entry/loyalty/account", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password })
      });
      const payload = await response.json() as {
        message?: string;
        account?: { login?: string };
        loyalty?: { externalSearch?: boolean };
      };

      if (!response.ok) {
        setResult(payload.message || "Не удалось настроить loyalty", "is-error");
        return;
      }

      if (statusBox && statusTitle && statusDetails) {
        statusBox.classList.remove("status-required");
        statusBox.classList.add("status-ready");
        statusTitle.textContent = "ПОДКЛЮЧЕНО";
        statusDetails.textContent = `Аккаунт: ${payload.account?.login || login}`;
      }
      infoPanel?.removeAttribute("hidden");
      authPanel?.setAttribute("hidden", "");
      settingsPanel?.removeAttribute("hidden");
      setResult(payload.message || "Loyalty подключена", "is-success");
    } catch {
      setResult("Не удалось подключить loyalty", "is-error");
    }
  }

  currentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submit();
  });
}
