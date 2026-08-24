import { logMessage } from "../lib/observability/logger";
import { LoyaltyInstallation } from "./domain/loyalty-installation";

/**
 * Реакция среза лояльности на жизненный цикл решения (вызывается из src/api/vendor-endpoint.ts).
 *
 * МойСклад удаляет настройки лояльности на своей стороне вместе с решением (Uninstall),
 * поэтому признак «настройки переданы» сбрасывается и при удалении, и при повторной установке.
 * Токен при этом сохраняется и переиспользуется при повторном подключении.
 * Приостановка (Suspend) настройки лояльности в МоемСкладе не удаляет — на нее срез не реагирует.
 */
export const loyaltyLifecycle = {
  onInstall(appId: string, accountId: string): void {
    resetConnection(appId, accountId);
  },

  onUninstall(appId: string, accountId: string): void {
    resetConnection(appId, accountId);
  }
};

/**
 * Сбрасывает признак того, что МойСклад знает о подключении Loyalty API, сохраняя токен.
 */
function resetConnection(appId: string, accountId: string): void {
  const installation = LoyaltyInstallation.load(appId, accountId);

  if (!installation || !installation.isConnected()) {
    return;
  }

  installation.markDisconnected();
  installation.persist();
  logMessage("INFO", `Loyalty connection reset for appId=${appId} on accountId=${accountId}`);
}
