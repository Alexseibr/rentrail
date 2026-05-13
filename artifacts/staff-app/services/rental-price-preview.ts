export type PricePreviewInput = {
  basePricePerHour: number;
  estimatedDurationMinutes: number;
  unlockFee?: number;
  depositAmount?: number;
  currency: "RUB" | "USD" | "EUR";
};

export type PricePreviewResult = {
  currency: PricePreviewInput["currency"];
  unlockFee: number;
  rentalCost: number;
  subtotal: number;
  depositAmount: number;
  totalDueNow: number;
};

const ROUND_FACTOR = 100;

function roundMoney(value: number): number {
  return Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
}

export function buildPricePreview(
  input: PricePreviewInput,
): PricePreviewResult {
  const unlockFee = roundMoney(input.unlockFee ?? 0);
  const depositAmount = roundMoney(input.depositAmount ?? 0);
  const estimatedHours = input.estimatedDurationMinutes / 60;
  const rentalCost = roundMoney(input.basePricePerHour * estimatedHours);
  const subtotal = roundMoney(unlockFee + rentalCost);

  return {
    currency: input.currency,
    unlockFee,
    rentalCost,
    subtotal,
    depositAmount,
    totalDueNow: roundMoney(subtotal + depositAmount),
  };
}
