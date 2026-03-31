import { db, blacklistEntries, clients, type InsertBlacklistEntry } from "@workspace/db";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { NotFoundError } from "../lib/errors";

export async function createBlacklistEntry(data: InsertBlacklistEntry & { clientId?: string; companyId?: string }) {
  if (data.clientId && data.companyId) {
    const [client] = await db
      .select({ fullName: clients.fullName, phone: clients.phone, email: clients.email, documentNumber: clients.documentNumber })
      .from(clients)
      .where(and(eq(clients.id, data.clientId), eq(clients.companyId, data.companyId)))
      .limit(1);

    if (client) {
      data.fullNameSnapshot = data.fullNameSnapshot ?? client.fullName;
      data.phoneSnapshot = data.phoneSnapshot ?? client.phone;
      data.emailSnapshot = data.emailSnapshot ?? client.email;
      data.documentSnapshot = data.documentSnapshot ?? client.documentNumber;
    }
  }

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
  const now = new Date();

  const entries = await db
    .select()
    .from(blacklistEntries)
    .where(
      and(
        eq(blacklistEntries.clientId, clientId),
        or(
          isNull(blacklistEntries.endsAt),
          gt(blacklistEntries.endsAt, now),
        ),
      ),
    );

  const activeEntries = entries.filter((e) => {
    if (e.startsAt > now) return false;

    if (e.scopeType === "global") return true;
    if (e.scopeType === "company" && e.companyId === companyId) return true;
    if (e.scopeType === "branch" && e.branchId === branchId) return true;

    return false;
  });

  return {
    isBlacklisted: activeEntries.length > 0,
    entries: activeEntries,
  };
}
