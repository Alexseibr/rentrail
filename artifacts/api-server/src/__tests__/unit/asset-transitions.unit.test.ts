import { describe, it, expect } from "vitest";

const ASSET_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["available", "maintenance", "retired"],
  available: [
    "reserved",
    "awaiting_pickup",
    "rented",
    "charging",
    "maintenance",
    "blocked",
    "lost",
    "stolen",
    "retired",
  ],
  reserved: ["available", "awaiting_pickup", "maintenance", "blocked"],
  awaiting_pickup: ["rented", "available", "maintenance", "blocked"],
  rented: ["available", "overdue", "charging", "maintenance", "lost", "stolen"],
  overdue: [
    "available",
    "charging",
    "maintenance",
    "blocked",
    "lost",
    "stolen",
  ],
  charging: ["available", "maintenance"],
  maintenance: ["available", "retired", "blocked"],
  blocked: ["available", "maintenance", "retired"],
  lost: ["available", "retired"],
  stolen: ["available", "retired"],
  retired: [],
};

const STATUSES_UNAVAILABLE_FOR_RENTAL = [
  "rented",
  "overdue",
  "blocked",
  "lost",
  "stolen",
  "retired",
  "maintenance",
  "charging",
];

function validateAssetTransition(from: string, to: string): boolean {
  const allowed = ASSET_STATUS_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

function isAvailableForRental(status: string): boolean {
  return !STATUSES_UNAVAILABLE_FOR_RENTAL.includes(status);
}

describe("Asset Status Transitions", () => {
  describe("valid transitions", () => {
    const validPairs: [string, string][] = [
      ["draft", "available"],
      ["draft", "maintenance"],
      ["available", "rented"],
      ["available", "reserved"],
      ["available", "maintenance"],
      ["available", "retired"],
      ["rented", "available"],
      ["rented", "overdue"],
      ["rented", "maintenance"],
      ["rented", "lost"],
      ["overdue", "available"],
      ["maintenance", "available"],
      ["blocked", "available"],
      ["lost", "available"],
      ["lost", "retired"],
      ["stolen", "retired"],
    ];

    it.each(validPairs)("allows %s → %s", (from, to) => {
      expect(validateAssetTransition(from, to)).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    const invalidPairs: [string, string][] = [
      ["draft", "rented"],
      ["draft", "overdue"],
      ["rented", "draft"],
      ["rented", "reserved"],
      ["retired", "available"],
      ["retired", "rented"],
      ["charging", "rented"],
      ["blocked", "rented"],
      ["lost", "rented"],
    ];

    it.each(invalidPairs)("rejects %s → %s", (from, to) => {
      expect(validateAssetTransition(from, to)).toBe(false);
    });
  });

  describe("terminal state", () => {
    it("retired has no outbound transitions", () => {
      expect(ASSET_STATUS_TRANSITIONS["retired"]).toEqual([]);
    });
  });

  describe("rental availability", () => {
    it("available is eligible for rental", () => {
      expect(isAvailableForRental("available")).toBe(true);
    });

    it("reserved is eligible for rental", () => {
      expect(isAvailableForRental("reserved")).toBe(true);
    });

    it("draft is eligible for rental", () => {
      expect(isAvailableForRental("draft")).toBe(true);
    });

    const unavailable = [
      "rented",
      "overdue",
      "blocked",
      "lost",
      "stolen",
      "retired",
      "maintenance",
      "charging",
    ];
    it.each(unavailable)("%s is NOT eligible for rental", (status) => {
      expect(isAvailableForRental(status)).toBe(false);
    });
  });
});
