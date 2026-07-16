import WidgetSDK from "@moysklad/js-widget-sdk";
import "../globals";

WidgetSDK.create().autoResizeIframe();

const form = document.getElementById("loyaltyConnectForm") as HTMLFormElement | null;
const result = document.getElementById("loyaltyResult");
const button = form?.querySelector("button") as HTMLButtonElement | null;

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!result || !button) return;

  button.disabled = true;
  result.textContent = "Настройка...";
  result.classList.remove("is-error");

  const providerUrl = String(new FormData(form).get("providerUrl") ?? "");
  void fetch("/entry/loyalty/connect", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerUrl })
  }).then(async (response) => {
    const payload = await response.json() as { message?: string };
    if (!response.ok) {
      throw new Error(payload.message || "Не удалось настроить LoyaltyAPI");
    }
    window.location.reload();
  }).catch((error: unknown) => {
    result.textContent = error instanceof Error ? error.message : "Не удалось настроить LoyaltyAPI";
    result.classList.add("is-error");
    button.disabled = false;
  });
});
