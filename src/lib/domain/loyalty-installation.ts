import crypto from "node:crypto";

export type LoyaltyInstallationData = {
  appId: string;
  accountId: string;
  providerToken: string;
  externalSearch: boolean;
  updatedAt: number;
};

export interface LoyaltyInstallationRepository {
  load(appId: string, accountId: string): LoyaltyInstallationData | null;
  findByToken(token: string): LoyaltyInstallationData | null;
  save(data: LoyaltyInstallationData): void;
  delete(appId: string, accountId: string): void;
}

export class LoyaltyInstallation {
  private static repository: LoyaltyInstallationRepository | null = null;

  constructor(
    public readonly appId: string,
    public readonly accountId: string,
    public providerToken: string,
    public externalSearch = false,
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
      updatedAt: this.updatedAt
    };
  }

  private static fromData(data: LoyaltyInstallationData): LoyaltyInstallation {
    return new LoyaltyInstallation(
      data.appId,
      data.accountId,
      data.providerToken,
      data.externalSearch,
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
