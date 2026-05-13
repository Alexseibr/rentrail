import { describe, expect, it } from "vitest";

import {
  isPreviewFresh,
  type CachedPricePreview,
} from "../../services/price-preview-cache";

const mockPreview: CachedPricePreview = {
  data: {
    currency: "RUB",
    unlockFee: 49,
    rentalCost: 300,
    subtotal: 349,
    depositAmount: 1000,
    totalDueNow: 1349,
  },
  fetchedAt: 1_000,
};

describe("isPreviewFresh", () => {
  it("returns false when cache is missing", () => {
    expect(isPreviewFresh(undefined, 2_000, 60_000)).toBe(false);
  });

  it("returns true when cache age is below ttl", () => {
    expect(isPreviewFresh(mockPreview, 30_000, 60_000)).toBe(true);
  });

  it("returns false when cache age is above ttl", () => {
    expect(isPreviewFresh(mockPreview, 70_000, 60_000)).toBe(false);
  });
});
