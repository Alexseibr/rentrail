import { describe, expect, it } from "vitest";

import { buildPricePreview } from "../../services/rental-price-preview";

describe("buildPricePreview", () => {
  it("calculates transparent subtotal and total", () => {
    const result = buildPricePreview({
      basePricePerHour: 300,
      estimatedDurationMinutes: 90,
      unlockFee: 50,
      depositAmount: 1000,
      currency: "RUB",
    });

    expect(result).toEqual({
      currency: "RUB",
      unlockFee: 50,
      rentalCost: 450,
      subtotal: 500,
      depositAmount: 1000,
      totalDueNow: 1500,
    });
  });
});
