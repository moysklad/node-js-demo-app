import { Router, type Request, type Response } from "express";
import { config } from "../../lib/config/config";
import { sendBadGateway, sendBadRequest, sendForbidden, sendUnauthorized } from "../../lib/http/http-responses";
import { logMessage } from "../../lib/observability/logger";
import { resolveBackendContextFromSession } from "../../lib/session/user-context";
import { describeLoyaltyConnection, LoyaltyInstallation } from "../domain/loyalty-installation";
import { loyaltyVendorApi } from "../vendor-api";

/**
 * Backend-роут вкладки «Программа лояльности»: принимает настройки из формы
 * и передает их в МойСклад через Vendor API. Авторизация — та же, что у остальных
 * backend-роутов решения: активный контекст сессии и совпадающий contextNonce.
 */
export function createConnectLoyaltyRouter(): Router {
  const router = Router();

  router.post("/connect-loyalty", async (req: Request, res: Response) => {
    const authContext = resolveBackendContextFromSession(req);

    if (!authContext) {
      sendUnauthorized(res, "Ошибка авторизации: откройте iframe заново.");
      return;
    }

    if (!authContext.isAdmin) {
      sendForbidden(res);
      return;
    }

    const providerUrl = parseProviderUrl(req.body?.providerUrl);

    if (!providerUrl) {
      sendBadRequest(res, "Укажите корректный HTTP(S) URL провайдера Loyalty API");
      return;
    }

    const accountId = authContext.accountId;
    const externalSearch = parseExternalSearch(req.body?.externalSearch);
    const providerToken = parseProviderToken(req.body?.providerToken);
    // Новый токен сначала сохраняется как ожидающий: провайдер принимает его вместе с действующим, пока
    // МойСклад не подтвердит настройки. Так решение не получит 401, если МойСклад уже переключился
    // на новый токен, и не сломает работающее подключение, если переключения не было.
    const installation = LoyaltyInstallation.load(config.appId, accountId) ?? new LoyaltyInstallation(config.appId, accountId);

    if (!installation.canBeginUpdate(providerToken)) {
      res.status(409).send(
        "Исход предыдущего подключения еще не известен: МойСклад мог принять отправленный тогда токен. " +
          "Повторите подключение с пустым полем токена, чтобы отправить его еще раз."
      );
      return;
    }

    const pendingBefore = installation.pendingSettings();
    installation.beginUpdate(providerToken, externalSearch);
    installation.persist();

    const updated = await loyaltyVendorApi().updateLoyaltySettings(config.appId, accountId, {
      url: providerUrl,
      token: installation.pendingProviderToken ?? "",
      externalSearch
    });

    if (updated.outcome === "unknown") {
      logMessage("WARN", `Loyalty settings outcome is unknown for accountId=${accountId}: ${updated.message}`);
      sendBadGateway(res, `Не удалось подтвердить, что МойСклад принял настройки Loyalty API. ${updated.message}. Повторите подключение: до этого решение принимает и прежний, и новый токен.`);
      return;
    }

    if (updated.outcome === "rejected") {
      installation.discardUpdate(pendingBefore);
      installation.persist();
      // Показываем причину отказа Vendor API: без нее вендору неоткуда узнать,
      // что дело, например, в отсутствии loyaltyApi в дескрипторе решения.
      const code = updated.code !== null ? `Ошибка ${updated.code}: ` : "";
      sendBadGateway(res, `Не удалось передать настройки Loyalty API. ${code}${updated.message}`);
      return;
    }

    installation.confirmUpdate();
    installation.persist();
    logMessage("INFO", `Loyalty settings sent to MoySklad for accountId=${accountId}, externalSearch=${externalSearch}`);

    res.json({
      message: "Настройки переданы в МойСклад через Vendor API",
      loyalty: describeLoyaltyConnection(installation)
    });
  });

  return router;
}

export function defaultLoyaltyProviderUrl(): string {
  return `${config.appBaseUrl.replace(/\/+$/, "")}/loyalty`;
}

function parseProviderUrl(value: unknown): string | null {
  const raw = typeof value === "string" && value.trim() ? value.trim() : defaultLoyaltyProviderUrl();

  try {
    const url = new URL(raw);

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;

    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function parseExternalSearch(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return value === "true" || value === "on" || value === "1";
  }

  return false;
}

function parseProviderToken(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const token = value.trim();

  return token ? token : null;
}
