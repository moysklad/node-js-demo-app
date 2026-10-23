import crypto from "node:crypto";
import type { LoyaltyConnectionState } from "../types";

export type LoyaltyInstallationData = {
  appId: string;
  accountId: string;
  // Токен, который МойСклад принял через Vendor API. null — подключения еще не было.
  providerToken: string | null;
  externalSearch: boolean;
  // Момент, когда настройки были приняты Vendor API. null означает, что МойСклад про подключение не знает.
  connectedAt: number | null;
  // Настройки, отправленные в МойСклад, но еще не подтвержденные.
  pendingProviderToken: string | null;
  pendingExternalSearch: boolean;
  updatedAt: number;
};

export interface LoyaltyInstallationRepository {
  load(appId: string, accountId: string): LoyaltyInstallationData | null;
  /** Ищет установку по действующему или ожидающему токену. */
  findByToken(token: string): LoyaltyInstallationData | null;
  save(data: LoyaltyInstallationData): void;
  delete(appId: string, accountId: string): void;
}

/**
 * Состояние подключения программы лояльности для экрана настроек.
 * Подключение опционально: на статус решения (SettingsRequired/Activated) оно не влияет.
 */
export type { LoyaltyConnectionState } from "../types";

/**
 * Пример того, как решение показывает состояние подключения, которое не обязательно для работы решения.
 * Действующий токен появляется после первого подтвержденного подключения, а connectedAt сбрасывается,
 * когда МойСклад удаляет настройки лояльности вместе с решением.
 */
export function describeLoyaltyConnection(installation: LoyaltyInstallation | null): LoyaltyConnectionState {
  if (!installation || installation.providerToken === null) {
    return {
      state: "not-connected",
      badge: "orange",
      title: "Программа лояльности не подключена",
      details: "Передайте адрес и токен вашего Loyalty API через Vendor API, чтобы МойСклад начал обращаться к программе лояльности.",
      externalSearch: false
    };
  }

  if (!installation.isConnected()) {
    return {
      state: "reconnect-required",
      badge: "orange",
      title: "Требуется повторное подключение",
      details: "Решение переустанавливали: МойСклад удалил настройки лояльности вместе с решением. Токен сохранен, отправьте настройки заново.",
      externalSearch: installation.externalSearch
    };
  }

  return {
    state: "connected",
    badge: "green",
    title: "Программа лояльности подключена",
    details: installation.externalSearch
      ? "Внешний поиск покупателей включен: МойСклад ищет покупателей через ваш Loyalty API."
      : "Внешний поиск покупателей выключен: МойСклад ищет покупателей в своей базе.",
    externalSearch: installation.externalSearch
  };
}

/**
 * Подключение программы лояльности на аккаунте. Настройки меняются в два шага: сначала решение
 * запоминает ожидающий токен, потом передает его в МойСклад. Пока исход не подтвержден, провайдер
 * принимает и действующий, и ожидающий токен — так неудачное переподключение не ломает кассу.
 */
export type PendingLoyaltySettings = { providerToken: string | null; externalSearch: boolean };

export class LoyaltyInstallation {
  private static repository: LoyaltyInstallationRepository | null = null;
  // Ожидающие настройки на момент начала текущей попытки: при отказе возвращаются, их исход так и не известен.

  constructor(
    public readonly appId: string,
    public readonly accountId: string,
    public providerToken: string | null = null,
    public externalSearch = false,
    public connectedAt: number | null = null,
    public pendingProviderToken: string | null = null,
    public pendingExternalSearch = false,
    public updatedAt = 0
  ) {}

  static configureRepository(repository: LoyaltyInstallationRepository): void {
    LoyaltyInstallation.repository = repository;
  }

  static load(appId: string, accountId: string): LoyaltyInstallation | null {
    const data = LoyaltyInstallation.getRepository().load(appId, accountId);
    return data ? LoyaltyInstallation.fromData(data) : null;
  }

  static findByToken(token: string): LoyaltyInstallation | null {
    const normalized = token.trim();

    if (normalized === "") {
      return null;
    }

    const data = LoyaltyInstallation.getRepository().findByToken(normalized);
    return data ? LoyaltyInstallation.fromData(data) : null;
  }

  static delete(appId: string, accountId: string): void {
    LoyaltyInstallation.getRepository().delete(appId, accountId);
  }

  isConnected(): boolean {
    return this.connectedAt !== null;
  }

  acceptsToken(token: string): boolean {
    const candidate = Buffer.from(token);

    return [this.providerToken, this.pendingProviderToken].some((stored) => {
      if (stored === null) {
        return false;
      }

      const storedBuffer = Buffer.from(stored);
      return storedBuffer.length === candidate.length && crypto.timingSafeEqual(storedBuffer, candidate);
    });
  }

  allowsExternalSearch(): boolean {
    return this.externalSearch || (this.pendingProviderToken !== null && this.pendingExternalSearch);
  }

  pendingSettings(): PendingLoyaltySettings {
    return { providerToken: this.pendingProviderToken, externalSearch: this.pendingExternalSearch };
  }

  /** Пока исход ожидающего токена не известен, заменить его другим нельзя: МойСклад мог его принять. */
  canBeginUpdate(providerToken: string | null): boolean {
    return this.pendingProviderToken === null || providerToken === null || providerToken === this.pendingProviderToken;
  }

  /** Запоминает новые настройки как ожидающие: до подтверждения Vendor API действующий токен не меняется. */
  beginUpdate(providerToken: string | null, externalSearch: boolean): void {
    this.pendingProviderToken = providerToken ?? this.pendingProviderToken ?? this.providerToken ?? crypto.randomBytes(32).toString("hex");
    this.pendingExternalSearch = externalSearch;
  }

  /** МойСклад принял настройки: ожидающие становятся действующими. */
  confirmUpdate(): void {
    this.providerToken = this.pendingProviderToken;
    this.externalSearch = this.pendingExternalSearch;
    this.connectedAt = Date.now();
    this.clearPending();
  }

  /** МойСклад отказал: действующее подключение остается прежним, возвращаются ожидающие настройки до этой попытки. */
  discardUpdate(previousPending: PendingLoyaltySettings): void {
    this.pendingProviderToken = previousPending.providerToken;
    this.pendingExternalSearch = previousPending.externalSearch;
  }

  private clearPending(): void {
    this.pendingProviderToken = null;
    this.pendingExternalSearch = false;
  }

  /**
   * Сбрасывает признак подключения, сохраняя токен.
   * МойСклад удаляет настройки лояльности при удалении решения с аккаунта, поэтому
   * после повторной установки их необходимо передать заново.
   */
  markDisconnected(): void {
    this.connectedAt = null;
    this.clearPending();
  }

  persist(): void {
    this.updatedAt = Date.now();
    LoyaltyInstallation.getRepository().save(this.toData());
  }

  private toData(): LoyaltyInstallationData {
    return {
      appId: this.appId,
      accountId: this.accountId,
      providerToken: this.providerToken,
      externalSearch: this.externalSearch,
      connectedAt: this.connectedAt,
      pendingProviderToken: this.pendingProviderToken,
      pendingExternalSearch: this.pendingExternalSearch,
      updatedAt: this.updatedAt
    };
  }

  private static fromData(data: LoyaltyInstallationData): LoyaltyInstallation {
    return new LoyaltyInstallation(
      data.appId,
      data.accountId,
      data.providerToken,
      data.externalSearch,
      data.connectedAt,
      data.pendingProviderToken,
      data.pendingExternalSearch,
      data.updatedAt
    );
  }

  private static getRepository(): LoyaltyInstallationRepository {
    if (!LoyaltyInstallation.repository) {
      throw new Error("Loyalty installation repository is not configured");
    }
    return LoyaltyInstallation.repository;
  }
}
