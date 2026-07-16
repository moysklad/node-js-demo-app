import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ensurePrivateDir } from "../security/security";
import {
  LoyaltyBonusLedgerError,
  type LoyaltyBonusLedgerRepository,
  type LoyaltyReturnInput,
  type LoyaltySaleInput
} from "./loyalty-bonus-ledger";

type TransactionRow = {
  document_id: string;
  source_sale_id: string | null;
  customer_ms_id: string;
  retail_store_id: string;
  receipt_total: number;
  bonus_spent: number;
  bonus_earned: number;
};

export class SqliteLoyaltyBonusLedgerRepository implements LoyaltyBonusLedgerRepository {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    ensurePrivateDir(path.dirname(filename));
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA busy_timeout=5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loyalty_internal_bonus_transaction (
        application_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        document_type TEXT NOT NULL CHECK (document_type IN ('SALE', 'RETURN')),
        document_id TEXT NOT NULL,
        source_sale_id TEXT,
        customer_ms_id TEXT NOT NULL,
        retail_store_id TEXT NOT NULL,
        receipt_total REAL NOT NULL,
        bonus_spent REAL NOT NULL,
        bonus_earned REAL NOT NULL,
        balance_before REAL NOT NULL,
        balance_after REAL NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (application_id, account_id, document_type, document_id)
      );
      CREATE INDEX IF NOT EXISTS loyalty_internal_bonus_transaction_source_sale
        ON loyalty_internal_bonus_transaction (application_id, account_id, source_sale_id);
    `);
  }

  commitSale(input: LoyaltySaleInput): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.findTransaction(input.appId, input.accountId, "SALE", input.documentId);
      if (existing) {
        assertSameSale(existing, input);
        this.db.exec("COMMIT");
        return;
      }

      const balanceBefore = this.loadBalance(input.appId, input.accountId, input.customerMsId);
      if (input.bonusSpent > Math.max(0, balanceBefore)) {
        throw new LoyaltyBonusLedgerError("Недостаточно бонусных баллов", "INSUFFICIENT_BALANCE");
      }
      const balanceAfter = roundMoney(balanceBefore - input.bonusSpent + input.bonusEarned);
      this.updateBalance(input.appId, input.accountId, input.customerMsId, balanceAfter);
      this.insertTransaction({
        ...input,
        documentType: "SALE",
        sourceSaleId: null,
        balanceBefore,
        balanceAfter
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  commitReturn(input: LoyaltyReturnInput): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.findTransaction(input.appId, input.accountId, "RETURN", input.documentId);
      if (existing) {
        assertSameReturn(existing, input);
        this.db.exec("COMMIT");
        return;
      }

      const sale = this.findTransaction(input.appId, input.accountId, "SALE", input.sourceSaleId);
      if (!sale) {
        throw new LoyaltyBonusLedgerError("Связанная продажа не найдена", "SALE_NOT_FOUND");
      }
      if (input.customerMsId && input.customerMsId !== sale.customer_ms_id) {
        throw new LoyaltyBonusLedgerError("Покупатель возврата не совпадает с покупателем продажи", "INVALID_RETURN");
      }

      const reversed = this.db.prepare(`
        SELECT COALESCE(SUM(receipt_total), 0) AS receipt_total,
               COALESCE(SUM(bonus_spent), 0) AS bonus_spent,
               COALESCE(SUM(bonus_earned), 0) AS bonus_earned
        FROM loyalty_internal_bonus_transaction
        WHERE application_id = ? AND account_id = ?
          AND document_type = 'RETURN' AND source_sale_id = ?
      `).get(input.appId, input.accountId, input.sourceSaleId) as {
        receipt_total: number;
        bonus_spent: number;
        bonus_earned: number;
      };
      const cumulativeReturn = roundMoney(Number(reversed.receipt_total) + input.receiptTotal);
      if (input.receiptTotal <= 0 || cumulativeReturn > Number(sale.receipt_total) + 0.001) {
        throw new LoyaltyBonusLedgerError("Сумма возвратов превышает сумму продажи", "INVALID_RETURN");
      }

      const ratio = Math.min(1, cumulativeReturn / Number(sale.receipt_total));
      const bonusSpent = roundMoney(Number(sale.bonus_spent) * ratio - Number(reversed.bonus_spent));
      const bonusEarned = roundMoney(Number(sale.bonus_earned) * ratio - Number(reversed.bonus_earned));
      const customerMsId = sale.customer_ms_id;
      const balanceBefore = this.loadBalance(input.appId, input.accountId, customerMsId);
      const balanceAfter = roundMoney(balanceBefore + bonusSpent - bonusEarned);
      this.updateBalance(input.appId, input.accountId, customerMsId, balanceAfter);
      this.insertTransaction({
        ...input,
        customerMsId,
        documentType: "RETURN",
        bonusSpent,
        bonusEarned,
        balanceBefore,
        balanceAfter
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private findTransaction(
    appId: string,
    accountId: string,
    documentType: "SALE" | "RETURN",
    documentId: string
  ): TransactionRow | null {
    return (this.db.prepare(`
      SELECT * FROM loyalty_internal_bonus_transaction
      WHERE application_id = ? AND account_id = ? AND document_type = ? AND document_id = ?
    `).get(appId, accountId, documentType, documentId) as TransactionRow | undefined) ?? null;
  }

  private loadBalance(appId: string, accountId: string, customerMsId: string): number {
    const row = this.db.prepare(`
      SELECT agent_bonus_balance FROM loyalty_customer
      WHERE application_id = ? AND account_id = ? AND ms_id = ?
    `).get(appId, accountId, customerMsId) as { agent_bonus_balance: number } | undefined;
    if (!row) {
      throw new LoyaltyBonusLedgerError("Покупатель не зарегистрирован в программе лояльности", "CUSTOMER_NOT_FOUND");
    }
    return Number(row.agent_bonus_balance);
  }

  private updateBalance(appId: string, accountId: string, customerMsId: string, balance: number): void {
    this.db.prepare(`
      UPDATE loyalty_customer SET agent_bonus_balance = ?, updated_at = ?
      WHERE application_id = ? AND account_id = ? AND ms_id = ?
    `).run(balance, new Date().toISOString(), appId, accountId, customerMsId);
  }

  private insertTransaction(input: {
    appId: string;
    accountId: string;
    documentType: "SALE" | "RETURN";
    documentId: string;
    sourceSaleId: string | null;
    customerMsId: string;
    retailStoreId: string;
    receiptTotal: number;
    bonusSpent: number;
    bonusEarned: number;
    balanceBefore: number;
    balanceAfter: number;
  }): void {
    this.db.prepare(`
      INSERT INTO loyalty_internal_bonus_transaction (
        application_id, account_id, document_type, document_id, source_sale_id,
        customer_ms_id, retail_store_id, receipt_total, bonus_spent, bonus_earned,
        balance_before, balance_after, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.appId, input.accountId, input.documentType, input.documentId, input.sourceSaleId,
      input.customerMsId, input.retailStoreId, input.receiptTotal, input.bonusSpent,
      input.bonusEarned, input.balanceBefore, input.balanceAfter, new Date().toISOString()
    );
  }
}

function assertSameSale(row: TransactionRow, input: LoyaltySaleInput): void {
  if (row.customer_ms_id !== input.customerMsId
    || row.retail_store_id !== input.retailStoreId
    || !sameMoney(row.receipt_total, input.receiptTotal)
    || !sameMoney(row.bonus_spent, input.bonusSpent)
    || !sameMoney(row.bonus_earned, input.bonusEarned)) {
    throw new LoyaltyBonusLedgerError("Продажа уже зарегистрирована с другими данными", "DOCUMENT_CONFLICT");
  }
}

function assertSameReturn(row: TransactionRow, input: LoyaltyReturnInput): void {
  if (row.source_sale_id !== input.sourceSaleId
    || (input.customerMsId !== undefined && row.customer_ms_id !== input.customerMsId)
    || row.retail_store_id !== input.retailStoreId
    || !sameMoney(row.receipt_total, input.receiptTotal)) {
    throw new LoyaltyBonusLedgerError("Возврат уже зарегистрирован с другими данными", "DOCUMENT_CONFLICT");
  }
}

function sameMoney(left: number, right: number): boolean {
  return Math.abs(Number(left) - right) < 0.001;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
