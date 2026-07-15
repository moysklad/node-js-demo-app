import crypto from "node:crypto";

export type LoyaltyAccountData = {
  appId: string;
  accountId: string;
  login: string;
  passwordHash: string;
  token: string;
  updatedAt: number;
};

export interface LoyaltyAccountRepository {
  load(appId: string, accountId: string): LoyaltyAccountData | null;
  findByLogin(login: string): LoyaltyAccountData | null;
  findByToken(token: string): LoyaltyAccountData | null;
  save(data: LoyaltyAccountData): void;
  delete(appId: string, accountId: string): void;
}

export class LoyaltyAccount {
  private static repository: LoyaltyAccountRepository | null = null;

  constructor(
    public readonly appId: string,
    public readonly accountId: string,
    public login = "",
    public passwordHash = "",
    public token = "",
    public updatedAt = 0
  ) {}

  static configureRepository(repository: LoyaltyAccountRepository): void {
    LoyaltyAccount.repository = repository;
  }

  static load(appId: string, accountId: string): LoyaltyAccount | null {
    const data = LoyaltyAccount.getRepository().load(appId, accountId);
    return data ? LoyaltyAccount.fromData(data) : null;
  }

  static register(appId: string, accountId: string, login: string, password: string, persist = true): LoyaltyAccount {
    const normalizedLogin = login.trim();
    const account = new LoyaltyAccount(
      appId,
      accountId,
      normalizedLogin,
      hashPassword(password),
      crypto.randomBytes(32).toString("hex")
    );
    if (persist) {
      LoyaltyAccount.getRepository().save(account.toData());
    }
    return account;
  }

  static verifyPassword(account: LoyaltyAccount, password: string): boolean {
    return verifyPasswordHash(password, account.passwordHash);
  }

  static findByLogin(login: string): LoyaltyAccount | null {
    const data = LoyaltyAccount.getRepository().findByLogin(login.trim());
    return data ? LoyaltyAccount.fromData(data) : null;
  }

  static findByToken(token: string): LoyaltyAccount | null {
    const data = LoyaltyAccount.getRepository().findByToken(token.trim());
    return data ? LoyaltyAccount.fromData(data) : null;
  }

  static deleteForAccount(appId: string, accountId: string): void {
    LoyaltyAccount.getRepository().delete(appId, accountId);
  }

  persist(): void {
    this.updatedAt = Date.now();
    LoyaltyAccount.getRepository().save(this.toData());
  }

  delete(): void {
    LoyaltyAccount.getRepository().delete(this.appId, this.accountId);
  }

  private toData(): LoyaltyAccountData {
    return {
      appId: this.appId,
      accountId: this.accountId,
      login: this.login,
      passwordHash: this.passwordHash,
      token: this.token,
      updatedAt: this.updatedAt
    };
  }

  private static fromData(data: LoyaltyAccountData): LoyaltyAccount {
    return new LoyaltyAccount(data.appId, data.accountId, data.login, data.passwordHash, data.token, data.updatedAt);
  }

  private static getRepository(): LoyaltyAccountRepository {
    if (!LoyaltyAccount.repository) {
      throw new Error("Loyalty account repository is not configured");
    }
    return LoyaltyAccount.repository;
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `scrypt:v1:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

function verifyPasswordHash(password: string, encoded: string): boolean {
  const [, version, saltEncoded, hashEncoded] = encoded.split(":");
  if (version !== "v1" || !saltEncoded || !hashEncoded) {
    return false;
  }

  try {
    const expected = Buffer.from(hashEncoded, "base64url");
    const actual = crypto.scryptSync(password, Buffer.from(saltEncoded, "base64url"), expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
