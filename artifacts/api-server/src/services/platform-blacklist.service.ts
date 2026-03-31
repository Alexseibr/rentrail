import { db, blacklistEntries, type BlacklistEntry } from "@workspace/db";
import { eq, and, desc, count, sql, ilike, or, gte, lte } from "drizzle-orm";
import { NotFoundError } from "../lib/errors";

type ActionType = BlacklistEntry["actionType"];
type ScopeType = BlacklistEntry["scopeType"];

export interface GlobalBlacklistListOptions {
  actionType?: ActionType;
  active?: boolean;
  reasonCode?: string;
  search?: string;
  phone?: string;
  email?: string;
  document?: string;
  fullName?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function listGlobalBlacklistEntries(opts: GlobalBlacklistListOptions) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [eq(blacklistEntries.scopeType, "global" as ScopeType)];
  if (opts.actionType) conditions.push(eq(blacklistEntries.actionType, opts.actionType));
  if (opts.reasonCode) conditions.push(eq(blacklistEntries.reasonCode, opts.reasonCode));
  if (opts.from) conditions.push(gte(blacklistEntries.createdAt, opts.from));
  if (opts.to) conditions.push(lte(blacklistEntries.createdAt, opts.to));

  if (opts.phone) conditions.push(ilike(blacklistEntries.phoneSnapshot, `%${opts.phone}%`));
  if (opts.email) conditions.push(ilike(blacklistEntries.emailSnapshot, `%${opts.email}%`));
  if (opts.document) conditions.push(ilike(blacklistEntries.documentSnapshot, `%${opts.document}%`));
  if (opts.fullName) conditions.push(ilike(blacklistEntries.fullNameSnapshot, `%${opts.fullName}%`));

  if (opts.active === true) {
    conditions.push(
      sql`${blacklistEntries.startsAt} <= NOW() AND (${blacklistEntries.endsAt} IS NULL OR ${blacklistEntries.endsAt} > NOW())`,
    );
  } else if (opts.active === false) {
    conditions.push(
      sql`(${blacklistEntries.startsAt} > NOW() OR (${blacklistEntries.endsAt} IS NOT NULL AND ${blacklistEntries.endsAt} <= NOW()))`,
    );
  }

  if (opts.search) {
    const pattern = `%${opts.search}%`;
    conditions.push(
      or(
        ilike(blacklistEntries.fullNameSnapshot, pattern),
        ilike(blacklistEntries.phoneSnapshot, pattern),
        ilike(blacklistEntries.emailSnapshot, pattern),
        ilike(blacklistEntries.documentSnapshot, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(blacklistEntries).where(where);
  const total = totalResult?.count ?? 0;

  const rows = await db
    .select()
    .from(blacklistEntries)
    .where(where)
    .orderBy(desc(blacklistEntries.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getGlobalBlacklistEntry(id: string) {
  const [entry] = await db
    .select()
    .from(blacklistEntries)
    .where(and(eq(blacklistEntries.id, id), eq(blacklistEntries.scopeType, "global" as ScopeType)))
    .limit(1);

  if (!entry) throw new NotFoundError("Global blacklist entry not found");
  return entry;
}

export async function createGlobalBlacklistEntry(input: {
  actionType: ActionType;
  reasonCode: string;
  reasonText?: string;
  fullNameSnapshot?: string;
  phoneSnapshot?: string;
  emailSnapshot?: string;
  documentSnapshot?: string;
  startsAt?: Date;
  endsAt?: Date;
  createdByUserId: string;
}) {
  const [entry] = await db
    .insert(blacklistEntries)
    .values({
      scopeType: "global" as ScopeType,
      companyId: null,
      branchId: null,
      clientId: null,
      actionType: input.actionType,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText ?? null,
      fullNameSnapshot: input.fullNameSnapshot ?? null,
      phoneSnapshot: input.phoneSnapshot ?? null,
      emailSnapshot: input.emailSnapshot ?? null,
      documentSnapshot: input.documentSnapshot ?? null,
      startsAt: input.startsAt ?? new Date(),
      endsAt: input.endsAt ?? null,
      createdByUserId: input.createdByUserId,
    })
    .returning();

  return entry;
}

export async function updateGlobalBlacklistEntry(id: string, input: Partial<{
  actionType: ActionType;
  reasonCode: string;
  reasonText: string | null;
  fullNameSnapshot: string | null;
  phoneSnapshot: string | null;
  emailSnapshot: string | null;
  documentSnapshot: string | null;
  endsAt: Date | null;
}>) {
  const existing = await getGlobalBlacklistEntry(id);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.actionType !== undefined) updateData.actionType = input.actionType;
  if (input.reasonCode !== undefined) updateData.reasonCode = input.reasonCode;
  if (input.reasonText !== undefined) updateData.reasonText = input.reasonText;
  if (input.fullNameSnapshot !== undefined) updateData.fullNameSnapshot = input.fullNameSnapshot;
  if (input.phoneSnapshot !== undefined) updateData.phoneSnapshot = input.phoneSnapshot;
  if (input.emailSnapshot !== undefined) updateData.emailSnapshot = input.emailSnapshot;
  if (input.documentSnapshot !== undefined) updateData.documentSnapshot = input.documentSnapshot;
  if (input.endsAt !== undefined) updateData.endsAt = input.endsAt;

  const [updated] = await db
    .update(blacklistEntries)
    .set(updateData)
    .where(eq(blacklistEntries.id, id))
    .returning();

  return { updated, previous: existing };
}

export async function enableGlobalBlacklistEntry(id: string) {
  const entry = await getGlobalBlacklistEntry(id);

  if (entry.endsAt && entry.endsAt <= new Date()) {
    const [updated] = await db
      .update(blacklistEntries)
      .set({ endsAt: null, updatedAt: new Date() })
      .where(eq(blacklistEntries.id, id))
      .returning();
    return { updated, previous: entry };
  }

  return { updated: entry, previous: entry };
}

export async function disableGlobalBlacklistEntry(id: string) {
  const entry = await getGlobalBlacklistEntry(id);

  const [updated] = await db
    .update(blacklistEntries)
    .set({ endsAt: new Date(), updatedAt: new Date() })
    .where(eq(blacklistEntries.id, id))
    .returning();

  return { updated, previous: entry };
}
