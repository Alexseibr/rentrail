import { db, blacklistEntries, type InsertBlacklistEntry } from "@workspace/db";
import { eq, and, or, isNull } from "drizzle-orm";
import { NotFoundError } from "../lib/errors";

export async function createBlacklistEntry(data: InsertBlacklistEntry) {
  const [entry] = await db.insert(blacklistEntries).values(data).returning();
  return entry;
}

export async function listBlacklistEntries(companyId: string) {
  return db
    .select()
    .from(blacklistEntries)
    .where(eq(blacklistEntries.companyId, companyId));
}

export async function getBlacklistEntry(id: string) {
  const [entry] = await db
    .select()
    .from(blacklistEntries)
    .where(eq(blacklistEntries.id, id))
    .limit(1);

  if (!entry) {
    throw new NotFoundError("Blacklist entry not found");
  }
  return entry;
}

export async function checkClientBlacklist(clientId: string, companyId: string, branchId?: string) {
  const conditions = [
    and(
      eq(blacklistEntries.clientId, clientId),
      eq(blacklistEntries.isActive, true),
      or(
        isNull(blacklistEntries.expiresAt),
        // We can't easily do a > comparison inline, so filter after
      ),
    ),
  ];

  const entries = await db
    .select()
    .from(blacklistEntries)
    .where(
      and(
        eq(blacklistEntries.clientId, clientId),
        eq(blacklistEntries.isActive, true),
      ),
    );

  const now = new Date();
  const activeEntries = entries.filter((e) => {
    if (e.expiresAt && e.expiresAt < now) return false;

    if (e.level === "global") return true;
    if (e.level === "company" && e.companyId === companyId) return true;
    if (e.level === "branch" && e.branchId === branchId) return true;

    return false;
  });

  return {
    isBlacklisted: activeEntries.length > 0,
    entries: activeEntries,
  };
}
