const EARNING_RATE = 0.05;

export interface BonusPolicy {
  bonusToSpend(receiptTotal: number, balance: number, preferredAmount?: number | null): number;
  bonusToEarn(paidAmount: number): number;
}

// Замените эту политику правилами вашей программы лояльности.
export const demoBonusPolicy: BonusPolicy = {
  bonusToSpend(receiptTotal, balance, preferredAmount) {
    return roundMoney(Math.min(preferredAmount ?? balance, balance, receiptTotal));
  },

  bonusToEarn(paidAmount) {
    return roundMoney(paidAmount * EARNING_RATE);
  }
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
