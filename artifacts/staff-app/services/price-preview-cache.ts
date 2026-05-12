export type PricePreviewValue = {
  rentalPlanId?: string | null;
  rentalPlanName?: string;
  estimatedDurationMinutes?: number;
  currency: "RUB" | "USD" | "EUR";
  unlockFee: number;
  rentalCost: number;
  subtotal: number;
  depositAmount: number;
  totalDueNow: number;
};

export type CachedPricePreview = {
  data: PricePreviewValue;
  fetchedAt: number;
};

export function isPreviewFresh(
  cached: CachedPricePreview | undefined,
  now: number,
  ttlMs: number,
): boolean {
  if (!cached) return false;
  return now - cached.fetchedAt < ttlMs;
}
