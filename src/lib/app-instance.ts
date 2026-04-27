import fs from "node:fs";
import path from "node:path";
import { cfg } from "./config";
import { logMessage } from "./logger";
import { ensurePrivateDir, writePrivateFileAtomic } from "./security";

export enum AppStatus {
  UNKNOWN = 0,
  SETTINGS_REQUIRED = 1,
  ACTIVATED = 100
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

export class AppInstance {
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

  persist(): void {
    ensurePrivateDir(cfg().dataDir);
    this.updatedAt = Date.now();
    writePrivateFileAtomic(this.filename(), JSON.stringify(this.toJSON()));
  }

  delete(): void {
    if (fs.existsSync(this.filename())) {
      fs.unlinkSync(this.filename());
    }
  }

  private filename(): string {
    return AppInstance.buildFilename(this.appId, this.accountId);
  }

  private static buildFilename(appId: string, accountId: string): string {
    return path.join(cfg().dataDir, `${appId}.${accountId}.app.json`);
  }

  static loadApp(accountId: string): AppInstance {
    return AppInstance.load(cfg().appId, accountId);
  }

  static load(appId: string, accountId: string): AppInstance {
    const filename = AppInstance.buildFilename(appId, accountId);
    let appInstance: AppInstance;

    if (!fs.existsSync(filename)) {
      appInstance = new AppInstance(appId, accountId);
      return appInstance;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(filename, "utf-8")) as Partial<AppInstanceData>;
      appInstance = AppInstance.fromData(appId, accountId, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logMessage("WARN", `Failed to load app instance from ${filename}: ${message}`);
      appInstance = new AppInstance(appId, accountId);
    }

    return appInstance;
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

  private static fromData(appId: string, accountId: string, data: Partial<AppInstanceData>): AppInstance {
    const appInstance = new AppInstance(appId, accountId);

    appInstance.appId = typeof data.appId === "string" ? data.appId : appId;
    appInstance.accountId = typeof data.accountId === "string" ? data.accountId : accountId;
    appInstance.infoMessage = typeof data.infoMessage === "string" ? data.infoMessage : "";
    appInstance.store = typeof data.store === "string" ? data.store : "";
    appInstance.accessToken = typeof data.accessToken === "string" ? data.accessToken : "";
    appInstance.status = isKnownAppStatus(data.status) ? data.status : AppStatus.UNKNOWN;
    appInstance.updatedAt = typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt) ? data.updatedAt : 0;

    return appInstance;
  }
}

function isKnownAppStatus(status: unknown): status is AppStatus {
  return status === AppStatus.UNKNOWN || status === AppStatus.SETTINGS_REQUIRED || status === AppStatus.ACTIVATED;
}
