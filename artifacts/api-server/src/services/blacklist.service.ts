import { db, blacklistEntries, clients, type InsertBlacklistEntry } from "@workspace/db";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

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

export async function getBlacklistEntry(id: string, companyId: string) {
  const [entry] = await db
    .select()
    .from(blacklistEntries)
    .where(and(eq(blacklistEntries.id, id), eq(blacklistEntries.companyId, companyId)))
    .limit(1);

  if (!entry) {
    throw new NotFoundError("Blacklist entry not found");
  }
  return entry;
}

export async function revokeBlacklistEntry(id: string, companyId: string) {
  const [entry] = await db
    .update(blacklistEntries)
    .set({ endsAt: new Date(), updatedAt: new Date() })
    .where(and(eq(blacklistEntries.id, id), eq(blacklistEntries.companyId, companyId)))
    .returning();

  if (!entry) {
    throw new NotFoundError("Blacklist entry not found");
  }
  return entry;
}

const ACTION_SEVERITY: Record<string, number> = {
  blocked_global: 7,
  blocked_company: 6,
  blocked_branch: 5,
  restricted_access: 4,
  increased_deposit: 3,
  manual_approval_only: 2,
  warning: 1,
};

export interface BlacklistDecision {
  isBlacklisted: boolean;
  strongestAction: string | null;
  strongestSeverity: number;
  isBlocked: boolean;
  entries: typeof blacklistEntries.$inferSelect[];
}

export async function checkClientBlacklist(clientId: string, companyId: string, branchId?: string): Promise<BlacklistDecision> {
  const now = new Date();

  const [client] = await db
    .select({ phone: clients.phone, email: clients.email, documentNumber: clients.documentNumber })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const clientScopedEntries = await db
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

  const globalIdentityConditions: ReturnType<typeof eq>[] = [];
  if (client?.phone) globalIdentityConditions.push(eq(blacklistEntries.phoneSnapshot, client.phone));
  if (client?.email) globalIdentityConditions.push(eq(blacklistEntries.emailSnapshot, client.email));
  if (client?.documentNumber) globalIdentityConditions.push(eq(blacklistEntries.documentSnapshot, client.documentNumber));

  let globalEntries: typeof clientScopedEntries = [];
  if (globalIdentityConditions.length > 0) {
    globalEntries = await db
      .select()
      .from(blacklistEntries)
      .where(
        and(
          eq(blacklistEntries.scopeType, "global"),
          or(...globalIdentityConditions),
          or(
            isNull(blacklistEntries.endsAt),
            gt(blacklistEntries.endsAt, now),
          ),
        ),
      );
  }

  const seenIds = new Set<string>();
  const allEntries = [...clientScopedEntries, ...globalEntries].filter((e) => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });

  const activeEntries = allEntries.filter((e) => {
    if (e.startsAt > now) return false;

    if (e.scopeType === "global") return true;
    if (e.scopeType === "company" && e.companyId === companyId) return true;
    if (e.scopeType === "branch" && e.branchId === branchId) return true;

    return false;
  });

  let strongestAction: string | null = null;
  let strongestSeverity = 0;

  for (const entry of activeEntries) {
    const severity = ACTION_SEVERITY[entry.actionType] ?? 0;
    if (severity > strongestSeverity) {
      strongestSeverity = severity;
      strongestAction = entry.actionType;
    }
  }

  const isBlocked = strongestSeverity >= 5;

  return {
    isBlacklisted: activeEntries.length > 0,
    strongestAction,
    strongestSeverity,
    isBlocked,
    entries: activeEntries,
  };
}
