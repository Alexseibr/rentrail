import { describe, expect, it } from "vitest";

import {
  mapReturnRentalErrorCode,
  mapStartRentalErrorCode,
} from "../../services/rental-action-errors";

describe("rental-action-errors", () => {
  it("maps start rental statuses", () => {
    expect(mapStartRentalErrorCode(402)).toBe("payment_declined");
    expect(mapStartRentalErrorCode(423)).toBe("lock_unreachable");
    expect(mapStartRentalErrorCode(503)).toBe("network_unreachable");
    expect(mapStartRentalErrorCode(400)).toBe("unknown");
  });

  it("maps return rental statuses", () => {
    expect(mapReturnRentalErrorCode(423)).toBe("lock_unreachable");
    expect(mapReturnRentalErrorCode(503)).toBe("network_unreachable");
    expect(mapReturnRentalErrorCode(402)).toBe("unknown");
  });
});
