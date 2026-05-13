import { describe, expect, it } from "vitest";

import { getClientErrorMessage } from "../../services/client-error-message";

describe("getClientErrorMessage", () => {
  it("returns localized RU message", () => {
    expect(getClientErrorMessage("lock_unreachable", "ru")).toContain("замком");
  });

  it("returns localized EN message", () => {
    expect(getClientErrorMessage("gps_unavailable", "en")).toContain("GPS");
  });
});
