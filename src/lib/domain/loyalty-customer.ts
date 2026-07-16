export type LoyaltyCustomerData = {
  appId: string;
  accountId: string;
  msId: string;
  agentBonusBalance: number;
  updatedAt: number;
};

export interface LoyaltyCustomerRepository {
  find(appId: string, accountId: string, msId: string): LoyaltyCustomerData | null;
  save(data: LoyaltyCustomerData): void;
}

export class LoyaltyCustomer {
  private static repository: LoyaltyCustomerRepository | null = null;

  constructor(
    public readonly appId: string,
    public readonly accountId: string,
    public readonly msId: string,
    public agentBonusBalance = 0,
    public updatedAt = 0
  ) {}

  static configureRepository(repository: LoyaltyCustomerRepository): void {
    LoyaltyCustomer.repository = repository;
  }

  static find(appId: string, accountId: string, msId: string): LoyaltyCustomer | null {
    const data = LoyaltyCustomer.getRepository().find(appId, accountId, msId);
    return data ? LoyaltyCustomer.fromData(data) : null;
  }

  static create(appId: string, accountId: string, msId: string): LoyaltyCustomer {
    return new LoyaltyCustomer(appId, accountId, msId);
  }

  persist(): void {
    this.updatedAt = Date.now();
    LoyaltyCustomer.getRepository().save(this.toData());
  }

  private toData(): LoyaltyCustomerData {
    return {
      appId: this.appId,
      accountId: this.accountId,
      msId: this.msId,
      agentBonusBalance: this.agentBonusBalance,
      updatedAt: this.updatedAt
    };
  }

  private static fromData(data: LoyaltyCustomerData): LoyaltyCustomer {
    return new LoyaltyCustomer(
      data.appId,
      data.accountId,
      data.msId,
      data.agentBonusBalance,
      data.updatedAt
    );
  }

  private static getRepository(): LoyaltyCustomerRepository {
    if (!LoyaltyCustomer.repository) {
      throw new Error("Loyalty customer repository is not configured");
    }
    return LoyaltyCustomer.repository;
  }
}
