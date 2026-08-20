import crypto from "node:crypto";

export type LoyaltyInstallationData = {
  appId: string;
  accountId: string;
  providerToken: string;
  externalSearch: boolean;
  // Момент, когда настройки были приняты Vendor API. null означает, что МойСклад про подключение не знает.
  connectedAt: number | null;
  updatedAt: number;
};

export interface LoyaltyInstallationRepository {
  load(appId: string, accountId: string): LoyaltyInstallationData | null;
  findByToken(token: string): LoyaltyInstallationData | null;
  save(data: LoyaltyInstallationData): void;
  delete(appId: string, accountId: string): void;
}

/**
 * Состояние подключения программы лояльности для экрана настроек.
 * Подключение опционально: на статус решения (SettingsRequired/Activated) оно не влияет.
 */
export type LoyaltyConnectionState = {
  state: "not-connected" | "connected" | "reconnect-required";
  className: "status-required" | "status-ready";
  title: string;
  details: string;
  externalSearch: boolean;
};

/**
 * Пример того, как решение показывает состояние необязательной точки встраивания.
 * Строка установки существует только после первого подключения, а connectedAt сбрасывается,
 * когда МойСклад удаляет настройки лояльности вместе с решением.
 */
export function describeLoyaltyConnection(installation: LoyaltyInstallation | null): LoyaltyConnectionState {
  if (!installation) {
    return {
      state: "not-connected",
      className: "status-required",
      title: "ПРОГРАММА ЛОЯЛЬНОСТИ НЕ ПОДКЛЮЧЕНА",
      details: "Передайте адрес и токен вашего Loyalty API через Vendor API, чтобы МойСклад начал обращаться к программе лояльности.",
      externalSearch: false
    };
  }

  if (!installation.isConnected()) {
    return {
      state: "reconnect-required",
      className: "status-required",
      title: "ТРЕБУЕТСЯ ПОВТОРНОЕ ПОДКЛЮЧЕНИЕ",
      details: "Решение переустанавливали: МойСклад удалил настройки лояльности вместе с решением. Токен сохранен, отправьте настройки заново.",
      externalSearch: installation.externalSearch
    };
  }

  return {
    state: "connected",
    className: "status-ready",
    title: "ПРОГРАММА ЛОЯЛЬНОСТИ ПОДКЛЮЧЕНА",
    details: installation.externalSearch
      ? "Внешний поиск покупателей включен: МойСклад ищет покупателей через ваш Loyalty API."
      : "Внешний поиск покупателей выключен: МойСклад ищет покупателей в своей базе.",
    externalSearch: installation.externalSearch
  };
}

export class LoyaltyInstallation {
  private static repository: LoyaltyInstallationRepository | null = null;

  constructor(
    public readonly appId: string,
    public readonly accountId: string,
    public providerToken: string,
    public externalSearch = false,
    public connectedAt: number | null = null,
    public updatedAt = 0
  ) {}

  static configureRepository(repository: LoyaltyInstallationRepository): void {
    LoyaltyInstallation.repository = repository;
  }

  static create(appId: string, accountId: string, providerToken = crypto.randomBytes(32).toString("hex")): LoyaltyInstallation {
    return new LoyaltyInstallation(
      appId,
      accountId,
      providerToken,
      false
    );
  }

  static load(appId: string, accountId: string): LoyaltyInstallation | null {
    const data = LoyaltyInstallation.getRepository().load(appId, accountId);
    return data ? LoyaltyInstallation.fromData(data) : null;
  }

  static findByToken(token: string): LoyaltyInstallation | null {
    const data = LoyaltyInstallation.getRepository().findByToken(token.trim());
    return data ? LoyaltyInstallation.fromData(data) : null;
  }

  static delete(appId: string, accountId: string): void {
    LoyaltyInstallation.getRepository().delete(appId, accountId);
  }

  isConnected(): boolean {
    return this.connectedAt !== null;
  }

  /**
   * Отмечает, что настройки приняты Vendor API и МойСклад знает о подключении.
   */
  markConnected(): void {
    this.connectedAt = Date.now();
  }

  /**
   * Сбрасывает признак подключения, сохраняя токен.
   * МойСклад удаляет настройки лояльности при удалении решения с аккаунта, поэтому
   * после повторной установки их необходимо передать заново.
   */
  markDisconnected(): void {
    this.connectedAt = null;
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
