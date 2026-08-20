import { config } from "../config/config";

export enum AppStatus {
  UNKNOWN = 0,
  SETTINGS_REQUIRED = 1,
  SUSPENDED = 2,
  ACTIVATED = 3,
  // Решение удалено с аккаунта, но настройки сохранены для возможной повторной установки
  UNINSTALLED = 4
}

export type AppStatusName = "SettingsRequired" | "Activated";

export type AppInstanceData = {
  appId: string;
  accountId: string;
  infoMessage: string;
  store: string;
  accessToken: string;
  status: AppStatus;
  updatedAt: number;
};

export interface AppInstanceRepository {
  load(appId: string, accountId: string): AppInstanceData | null;
  save(data: AppInstanceData): void;
  delete(appId: string, accountId: string): void;
}

/**
 * Пример проверки готовности установки решения к работе.
 * Настройки переживают приостановку и удаление решения, поэтому этой же проверкой
 * решение определяет, можно ли продолжить работу без участия пользователя.
 */
export function hasRequiredSettings(app: AppInstance): boolean {
  return app.store.trim() !== "";
}

export class AppInstance {
  private static repository: AppInstanceRepository | null = null;

  appId: string;
  accountId: string;
  infoMessage = "";
  store = "";
  accessToken = "";
  status = AppStatus.UNKNOWN;
  updatedAt = 0;

  constructor(appId: string, accountId: string) {
    this.appId = appId;
    this.accountId = accountId;
  }

  getStatusName(): AppStatusName | null {
    switch (this.status) {
      case AppStatus.SETTINGS_REQUIRED:
        return "SettingsRequired";
      case AppStatus.ACTIVATED:
        return "Activated";
      default:
        return null;
    }
  }

  isInstalled(): boolean {
    return this.status !== AppStatus.UNKNOWN && this.status !== AppStatus.UNINSTALLED;
  }

  persist(): void {
    this.updatedAt = Date.now();
    AppInstance.getRepository().save(this.toJSON());
  }

  /**
   * Полностью удаляет установку вместе с настройками.
   * Используйте вместо uninstall(), если политика хранения данных требует удалять
   * пользовательские настройки при отключении решения от аккаунта.
   */
  delete(): void {
    AppInstance.getRepository().delete(this.appId, this.accountId);
  }

  /**
   * Помечает установку удаленной, сохраняя пользовательские настройки.
   * Токен доступа стирается: при повторной установке МойСклад пришлет новый.
   */
  uninstall(): void {
    this.status = AppStatus.UNINSTALLED;
    this.accessToken = "";
    this.persist();
  }

  suspend(): void {
    this.status = AppStatus.SUSPENDED;
    this.accessToken = "";
    this.persist();
  }

  static loadApp(accountId: string): AppInstance {
    return AppInstance.load(config.appId, accountId);
  }

  static load(appId: string, accountId: string): AppInstance {
    const loaded = AppInstance.getRepository().load(appId, accountId);
    return loaded ? AppInstance.fromData(appId, accountId, loaded) : new AppInstance(appId, accountId);
  }

  static configureRepository(repository: AppInstanceRepository): void {
    AppInstance.repository = repository;
  }

  private static getRepository(): AppInstanceRepository {
    if (!AppInstance.repository) {
      throw new Error("AppInstance repository is not configured");
    }
    return AppInstance.repository;
  }

  private toJSON(): AppInstanceData {
    return {
      appId: this.appId,
      accountId: this.accountId,
      infoMessage: this.infoMessage,
      store: this.store,
      accessToken: this.accessToken,
      status: this.status,
      updatedAt: this.updatedAt
    };
  }

  private static fromData(appId: string, accountId: string, data: AppInstanceData): AppInstance {
    const appInstance = new AppInstance(appId, accountId);

    appInstance.appId = data.appId;
    appInstance.accountId = data.accountId;
    appInstance.infoMessage = data.infoMessage;
    appInstance.store = data.store;
    appInstance.accessToken = data.accessToken;
    appInstance.status = isKnownAppStatus(data.status) ? data.status : AppStatus.UNKNOWN;
    appInstance.updatedAt = data.updatedAt;

    return appInstance;
  }
}

function isKnownAppStatus(status: unknown): status is AppStatus {
  return (
    status === AppStatus.UNKNOWN ||
    status === AppStatus.SETTINGS_REQUIRED ||
    status === AppStatus.SUSPENDED ||
    status === AppStatus.ACTIVATED ||
    status === AppStatus.UNINSTALLED
  );
}
