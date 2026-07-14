export type LoyaltySettingsData = {
  appId: string;
  accountId: string;
  loyaltyProviderUrl: string;
  loyaltyEncryptedKey: string;
  loyaltyExternalCustomers: boolean;
  updatedAt: number;
};

export type LoyaltySettingsUpdate = {
  loyaltyProviderUrl?: string;
  loyaltyEncryptedKey?: string;
  loyaltyExternalCustomers?: boolean;
};

export interface LoyaltyRepository {
  load(appId: string, accountId: string): LoyaltySettingsData | null;
  save(data: LoyaltySettingsData): void;
  delete(appId: string, accountId: string): void;
}

export class Loyalty {
  private static repository: LoyaltyRepository | null = null;

  appId: string;
  accountId: string;
  loyaltyProviderUrl = "";
  loyaltyEncryptedKey = "";
  loyaltyExternalCustomers = false;
  updatedAt = 0;

  constructor(appId: string, accountId: string) {
    this.appId = appId;
    this.accountId = accountId;
  }

  hasCredentials(): boolean {
    return this.loyaltyProviderUrl.trim() !== "" && this.loyaltyEncryptedKey.trim() !== "";
  }

  persist(): void {
    this.updatedAt = Date.now();
    Loyalty.getRepository().save(this.toData());
  }

  applyUpdate(update: LoyaltySettingsUpdate): void {
    if (update.loyaltyProviderUrl !== undefined) {
      this.loyaltyProviderUrl = update.loyaltyProviderUrl.trim();
    }

    if (update.loyaltyEncryptedKey !== undefined) {
      this.loyaltyEncryptedKey = update.loyaltyEncryptedKey.trim();
    }

    if (update.loyaltyExternalCustomers !== undefined) {
      this.loyaltyExternalCustomers = update.loyaltyExternalCustomers;
    }
  }

  static configureRepository(repository: LoyaltyRepository): void {
    Loyalty.repository = repository;
  }

  static load(appId: string, accountId: string): Loyalty {
    const loaded = Loyalty.getRepository().load(appId, accountId);
    return loaded ? Loyalty.fromData(loaded) : new Loyalty(appId, accountId);
  }

  static upsert(accountId: string, appId: string, update: LoyaltySettingsUpdate): Loyalty {
    const current = Loyalty.load(appId, accountId);
    current.applyUpdate(update);
    current.persist();
    return current;
  }

  static deleteForAccount(appId: string, accountId: string): void {
    Loyalty.getRepository().delete(appId, accountId);
  }

  private static getRepository(): LoyaltyRepository {
    if (!Loyalty.repository) {
      throw new Error("Loyalty repository is not configured");
    }

    return Loyalty.repository;
  }

  private toData(): LoyaltySettingsData {
    return {
      appId: this.appId,
      accountId: this.accountId,
      loyaltyProviderUrl: this.loyaltyProviderUrl,
      loyaltyEncryptedKey: this.loyaltyEncryptedKey,
      loyaltyExternalCustomers: this.loyaltyExternalCustomers,
      updatedAt: this.updatedAt
    };
  }

  private static fromData(data: LoyaltySettingsData): Loyalty {
    const loyalty = new Loyalty(data.appId, data.accountId);
    loyalty.loyaltyProviderUrl = data.loyaltyProviderUrl;
    loyalty.loyaltyEncryptedKey = data.loyaltyEncryptedKey;
    loyalty.loyaltyExternalCustomers = data.loyaltyExternalCustomers;
    loyalty.updatedAt = data.updatedAt;
    return loyalty;
  }
}
