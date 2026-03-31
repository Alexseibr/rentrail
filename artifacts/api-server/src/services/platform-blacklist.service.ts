import { db, blacklistEntries } from "@workspace/db";
import { eq, and, desc, count, sql, ilike, or, gte, lte, isNull } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

export interface GlobalBlacklistListOptions {
  actionType?: string;
  active?: boolean;
  reasonCode?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function listGlobalBlacklistEntries(opts: GlobalBlacklistListOptions) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [eq(blacklistEntries.scopeType, "global")];
  if (opts.actionType) conditions.push(eq(blacklistEntries.actionType, opts.actionType as any));
  if (opts.reasonCode) conditions.push(eq(blacklistEntries.reasonCode, opts.reasonCode));
  if (opts.from) conditions.push(gte(blacklistEntries.createdAt, opts.from));
  if (opts.to) conditions.push(lte(blacklistEntries.createdAt, opts.to));

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
    .where(and(eq(blacklistEntries.id, id), eq(blacklistEntries.scopeType, "global")))
    .limit(1);

  if (!entry) throw new NotFoundError("Global blacklist entry not found");
  return entry;
}

export async function createGlobalBlacklistEntry(input: {
  actionType: string;
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
      scopeType: "global",
      companyId: null,
      branchId: null,
      clientId: null,
      actionType: input.actionType as any,
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
  actionType: string;
  reasonCode: string;
  reasonText: string | null;
  fullNameSnapshot: string | null;
  phoneSnapshot: string | null;
  emailSnapshot: string | null;
  documentSnapshot: string | null;
  endsAt: Date | null;
}>) {
  const existing = await getGlobalBlacklistEntry(id);

  const [updated] = await db
    .update(blacklistEntries)
    .set({ ...input, updatedAt: new Date() } as any)
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
