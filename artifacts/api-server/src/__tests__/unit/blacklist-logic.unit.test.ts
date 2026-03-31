import { describe, it, expect } from "vitest";

interface BlacklistEntry {
  scopeType: "global" | "company" | "branch";
  companyId: string | null;
  branchId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  action: string;
  reason: string;
}

function resolveBlacklistEntries(
  entries: BlacklistEntry[],
  companyId: string,
  branchId: string | undefined,
  now: Date,
): BlacklistEntry[] {
  return entries.filter((e) => {
    if (e.startsAt > now) return false;
    if (e.endsAt && e.endsAt <= now) return false;

    if (e.scopeType === "global") return true;
    if (e.scopeType === "company" && e.companyId === companyId) return true;
    if (e.scopeType === "branch" && e.branchId === branchId) return true;

    return false;
  });
}

function getStrongestAction(entries: BlacklistEntry[]): string | null {
  const priority = ["blocked_global", "blocked_company", "blocked_branch", "warning"];
  for (const action of priority) {
    if (entries.some((e) => e.action === action)) return action;
  }
  return entries.length > 0 ? entries[0].action : null;
}

const COMPANY_A = "company-a";
const COMPANY_B = "company-b";
const BRANCH_X = "branch-x";
const BRANCH_Y = "branch-y";
const NOW = new Date("2025-06-15T12:00:00Z");

describe("Blacklist Resolution Logic", () => {
  describe("scope filtering", () => {
    it("global scope matches any company/branch", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "global", companyId: null, branchId: null, startsAt: new Date("2025-01-01"), endsAt: null, action: "blocked_global", reason: "fraud" },
      ];
      const result = resolveBlacklistEntries(entries, COMPANY_A, BRANCH_X, NOW);
      expect(result).toHaveLength(1);
    });

    it("company scope matches only matching company", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "company", companyId: COMPANY_A, branchId: null, startsAt: new Date("2025-01-01"), endsAt: null, action: "blocked_company", reason: "overdue" },
      ];
      expect(resolveBlacklistEntries(entries, COMPANY_A, undefined, NOW)).toHaveLength(1);
      expect(resolveBlacklistEntries(entries, COMPANY_B, undefined, NOW)).toHaveLength(0);
    });

    it("branch scope matches only matching branch", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "branch", companyId: COMPANY_A, branchId: BRANCH_X, startsAt: new Date("2025-01-01"), endsAt: null, action: "blocked_branch", reason: "damage" },
      ];
      expect(resolveBlacklistEntries(entries, COMPANY_A, BRANCH_X, NOW)).toHaveLength(1);
      expect(resolveBlacklistEntries(entries, COMPANY_A, BRANCH_Y, NOW)).toHaveLength(0);
    });

    it("branch scope does not match when branchId is undefined", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "branch", companyId: COMPANY_A, branchId: BRANCH_X, startsAt: new Date("2025-01-01"), endsAt: null, action: "blocked_branch", reason: "damage" },
      ];
      expect(resolveBlacklistEntries(entries, COMPANY_A, undefined, NOW)).toHaveLength(0);
    });
  });

  describe("temporal filtering", () => {
    it("excludes entries not yet started", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "global", companyId: null, branchId: null, startsAt: new Date("2026-01-01"), endsAt: null, action: "blocked_global", reason: "future" },
      ];
      expect(resolveBlacklistEntries(entries, COMPANY_A, undefined, NOW)).toHaveLength(0);
    });

    it("excludes expired entries", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "global", companyId: null, branchId: null, startsAt: new Date("2025-01-01"), endsAt: new Date("2025-06-01"), action: "blocked_global", reason: "expired" },
      ];
      expect(resolveBlacklistEntries(entries, COMPANY_A, undefined, NOW)).toHaveLength(0);
    });

    it("includes entries with no expiration", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "global", companyId: null, branchId: null, startsAt: new Date("2025-01-01"), endsAt: null, action: "blocked_global", reason: "permanent" },
      ];
      expect(resolveBlacklistEntries(entries, COMPANY_A, undefined, NOW)).toHaveLength(1);
    });
  });

  describe("strongest action resolution", () => {
    it("returns blocked_global as strongest", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "global", companyId: null, branchId: null, startsAt: new Date("2025-01-01"), endsAt: null, action: "blocked_global", reason: "a" },
        { scopeType: "company", companyId: COMPANY_A, branchId: null, startsAt: new Date("2025-01-01"), endsAt: null, action: "blocked_company", reason: "b" },
        { scopeType: "branch", companyId: COMPANY_A, branchId: BRANCH_X, startsAt: new Date("2025-01-01"), endsAt: null, action: "warning", reason: "c" },
      ];
      expect(getStrongestAction(entries)).toBe("blocked_global");
    });

    it("returns warning when only warnings exist", () => {
      const entries: BlacklistEntry[] = [
        { scopeType: "branch", companyId: COMPANY_A, branchId: BRANCH_X, startsAt: new Date("2025-01-01"), endsAt: null, action: "warning", reason: "minor" },
      ];
      expect(getStrongestAction(entries)).toBe("warning");
    });

    it("returns null for empty list", () => {
      expect(getStrongestAction([])).toBe(null);
    });
  });
});
