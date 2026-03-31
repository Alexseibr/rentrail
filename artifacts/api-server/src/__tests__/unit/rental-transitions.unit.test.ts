import { describe, it, expect } from "vitest";

const RENTAL_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_approval", "awaiting_payment", "awaiting_pickup", "canceled"],
  pending_approval: ["awaiting_payment", "awaiting_pickup", "canceled"],
  awaiting_payment: ["awaiting_pickup", "canceled"],
  awaiting_pickup: ["active", "canceled"],
  active: ["extended", "overdue", "return_requested", "completed", "canceled"],
  extended: ["overdue", "return_requested", "completed", "canceled"],
  overdue: ["return_requested", "completed", "defaulted"],
  return_requested: ["completed"],
  completed: [],
  canceled: [],
  disputed: ["completed", "defaulted"],
  defaulted: [],
};

function validateTransition(from: string, to: string): boolean {
  const allowed = RENTAL_STATUS_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

describe("Rental Status Transitions", () => {
  describe("valid transitions", () => {
    const validPairs: [string, string][] = [
      ["draft", "pending_approval"],
      ["draft", "awaiting_payment"],
      ["draft", "awaiting_pickup"],
      ["draft", "canceled"],
      ["pending_approval", "awaiting_payment"],
      ["awaiting_pickup", "active"],
      ["active", "extended"],
      ["active", "overdue"],
      ["active", "return_requested"],
      ["active", "completed"],
      ["active", "canceled"],
      ["overdue", "completed"],
      ["overdue", "defaulted"],
      ["return_requested", "completed"],
    ];

    it.each(validPairs)("allows %s → %s", (from, to) => {
      expect(validateTransition(from, to)).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    const invalidPairs: [string, string][] = [
      ["draft", "active"],
      ["draft", "completed"],
      ["draft", "overdue"],
      ["awaiting_pickup", "draft"],
      ["active", "draft"],
      ["active", "pending_approval"],
      ["completed", "active"],
      ["completed", "canceled"],
      ["canceled", "active"],
      ["canceled", "draft"],
      ["defaulted", "active"],
      ["return_requested", "canceled"],
    ];

    it.each(invalidPairs)("rejects %s → %s", (from, to) => {
      expect(validateTransition(from, to)).toBe(false);
    });
  });

  describe("terminal states", () => {
    it("completed has no outbound transitions", () => {
      expect(RENTAL_STATUS_TRANSITIONS["completed"]).toEqual([]);
    });

    it("canceled has no outbound transitions", () => {
      expect(RENTAL_STATUS_TRANSITIONS["canceled"]).toEqual([]);
    });

    it("defaulted has no outbound transitions", () => {
      expect(RENTAL_STATUS_TRANSITIONS["defaulted"]).toEqual([]);
    });
  });

  describe("all statuses have transition rules", () => {
    const allStatuses = [
      "draft", "pending_approval", "awaiting_payment", "awaiting_pickup",
      "active", "extended", "overdue", "return_requested",
      "completed", "canceled", "disputed", "defaulted",
    ];

    it.each(allStatuses)("status '%s' has transition rules defined", (status) => {
      expect(RENTAL_STATUS_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(RENTAL_STATUS_TRANSITIONS[status])).toBe(true);
    });
  });

  describe("unknown status", () => {
    it("returns false for unknown source status", () => {
      expect(validateTransition("nonexistent", "active")).toBe(false);
    });
  });
});
