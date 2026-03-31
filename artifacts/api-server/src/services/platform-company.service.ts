import {
  db,
  companies,
  branches,
  stations,
  assets,
  users,
  rentals,
  userCompanyMemberships,
  auditLogs,
  companyModerationEvents,
} from "@workspace/db";
import { eq, and, sql, ilike, or, desc, count } from "drizzle-orm";
import { NotFoundError, AppError, InvalidStatusTransitionError } from "../lib/errors";

type CompanyStatus = typeof companies.$inferSelect.status;

const MODERATION_TRANSITIONS: Record<string, string[]> = {
  pending: ["active", "blocked", "canceled"],
  trial: ["active", "suspended", "blocked", "canceled"],
  active: ["suspended", "blocked", "canceled"],
  past_due: ["active", "suspended", "blocked", "canceled"],
  suspended: ["active", "blocked", "canceled"],
  blocked: ["active"],
  canceled: [],
};

function validateModerationTransition(from: string, to: string) {
  const allowed = MODERATION_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidStatusTransitionError(from, to, "company");
  }
}

export interface PlatformCompanyListOptions {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function listPlatformCompanies(opts: PlatformCompanyListOptions) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];

  if (opts.status) {
    conditions.push(eq(companies.status, opts.status as CompanyStatus));
  }

  const searchConditions = opts.search
    ? or(
        ilike(companies.name, `%${opts.search}%`),
        ilike(companies.slug, `%${opts.search}%`),
        ilike(companies.email, `%${opts.search}%`),
      )
    : undefined;

  const baseWhere = conditions.length > 0
    ? and(...conditions, searchConditions)
    : searchConditions;

  const [totalResult] = await db
    .select({ count: count() })
    .from(companies)
    .where(baseWhere ?? undefined);

  const total = totalResult?.count ?? 0;

  const rows = await db
    .select()
    .from(companies)
    .where(baseWhere ?? undefined)
    .orderBy(desc(companies.createdAt))
    .limit(limit)
    .offset(offset);

  const companyIds = rows.map((r) => r.id);

  const countsPromises = companyIds.length > 0
    ? await Promise.all(
        companyIds.map(async (cid) => {
          const [branchCount] = await db
            .select({ count: count() })
            .from(branches)
            .where(eq(branches.companyId, cid));
          const [stationCount] = await db
            .select({ count: count() })
            .from(stations)
            .where(eq(stations.companyId, cid));
          const [assetCount] = await db
            .select({ count: count() })
            .from(assets)
            .where(eq(assets.companyId, cid));
          const [userCount] = await db
            .select({ count: count() })
            .from(userCompanyMemberships)
            .where(eq(userCompanyMemberships.companyId, cid));
          const [rentalCount] = await db
            .select({ count: count() })
            .from(rentals)
            .where(eq(rentals.companyId, cid));

          return {
            companyId: cid,
            branches: branchCount?.count ?? 0,
            stations: stationCount?.count ?? 0,
            assets: assetCount?.count ?? 0,
            users: userCount?.count ?? 0,
            rentals: rentalCount?.count ?? 0,
          };
        }),
      )
    : [];

  const countsMap = new Map(countsPromises.map((c) => [c.companyId, c]));

  const items = rows.map((row) => ({
    ...row,
    counts: countsMap.get(row.id) ?? { branches: 0, stations: 0, assets: 0, users: 0, rentals: 0 },
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPlatformCompanyDetail(companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) throw new NotFoundError("Company not found");

  const [branchCount] = await db.select({ count: count() }).from(branches).where(eq(branches.companyId, companyId));
  const [stationCount] = await db.select({ count: count() }).from(stations).where(eq(stations.companyId, companyId));
  const [assetCount] = await db.select({ count: count() }).from(assets).where(eq(assets.companyId, companyId));
  const [userCount] = await db.select({ count: count() }).from(userCompanyMemberships).where(eq(userCompanyMemberships.companyId, companyId));
  const [rentalCount] = await db.select({ count: count() }).from(rentals).where(eq(rentals.companyId, companyId));
  const [activeRentalCount] = await db
    .select({ count: count() })
    .from(rentals)
    .where(and(eq(rentals.companyId, companyId), eq(rentals.status, "active")));

  const moderationHistory = await db
    .select()
    .from(companyModerationEvents)
    .where(eq(companyModerationEvents.companyId, companyId))
    .orderBy(desc(companyModerationEvents.createdAt))
    .limit(10);

  return {
    ...company,
    counts: {
      branches: branchCount?.count ?? 0,
      stations: stationCount?.count ?? 0,
      assets: assetCount?.count ?? 0,
      users: userCount?.count ?? 0,
      rentals: rentalCount?.count ?? 0,
      activeRentals: activeRentalCount?.count ?? 0,
    },
    moderationHistory,
  };
}

export interface ModerationActionInput {
  reasonCode: string;
  reasonText?: string;
  performedBy: string;
}

async function performModerationAction(
  companyId: string,
  targetStatus: CompanyStatus,
  actionName: string,
  input: ModerationActionInput,
) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) throw new NotFoundError("Company not found");

  validateModerationTransition(company.status, targetStatus);

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(companies)
      .set({
        status: targetStatus,
        moderationReasonCode: input.reasonCode,
        moderationReasonText: input.reasonText ?? null,
        moderatedBy: input.performedBy,
        moderatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning();

    await tx.insert(companyModerationEvents).values({
      companyId,
      action: actionName,
      fromStatus: company.status,
      toStatus: targetStatus,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText ?? null,
      performedBy: input.performedBy,
    });

    return updated;
  });

  return { updated: result, previousStatus: company.status };
}

export async function approveCompany(companyId: string, input: ModerationActionInput) {
  return performModerationAction(companyId, "active", "approve", input);
}

export async function blockCompany(companyId: string, input: ModerationActionInput) {
  return performModerationAction(companyId, "blocked", "block", input);
}

export async function unblockCompany(companyId: string, input: ModerationActionInput) {
  return performModerationAction(companyId, "active", "unblock", input);
}

export async function suspendCompany(companyId: string, input: ModerationActionInput) {
  return performModerationAction(companyId, "suspended", "suspend", input);
}

export async function cancelCompany(companyId: string, input: ModerationActionInput) {
  return performModerationAction(companyId, "canceled", "cancel", input);
}

export async function getCompanyUsage(companyId: string) {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) throw new NotFoundError("Company not found");

  const [branchCount] = await db.select({ count: count() }).from(branches).where(eq(branches.companyId, companyId));
  const [stationCount] = await db.select({ count: count() }).from(stations).where(eq(stations.companyId, companyId));
  const [assetCount] = await db.select({ count: count() }).from(assets).where(eq(assets.companyId, companyId));
  const [userCount] = await db.select({ count: count() }).from(userCompanyMemberships).where(eq(userCompanyMemberships.companyId, companyId));
  const [rentalCount] = await db.select({ count: count() }).from(rentals).where(eq(rentals.companyId, companyId));

  return {
    companyId,
    companyName: company.name,
    resources: {
      branches: branchCount?.count ?? 0,
      stations: stationCount?.count ?? 0,
      assets: assetCount?.count ?? 0,
      users: userCount?.count ?? 0,
      rentals: rentalCount?.count ?? 0,
    },
  };
}

export async function getCompanyHealthSummary(companyId: string) {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) throw new NotFoundError("Company not found");

  const assetsByStatus = await db
    .select({ status: assets.status, count: count() })
    .from(assets)
    .where(eq(assets.companyId, companyId))
    .groupBy(assets.status);

  const rentalsByStatus = await db
    .select({ status: rentals.status, count: count() })
    .from(rentals)
    .where(eq(rentals.companyId, companyId))
    .groupBy(rentals.status);

  const overdueRentals = rentalsByStatus.find((r) => r.status === "overdue")?.count ?? 0;
  const disputedRentals = rentalsByStatus.find((r) => r.status === "disputed")?.count ?? 0;
  const lostAssets = assetsByStatus.find((a) => a.status === "lost")?.count ?? 0;
  const stolenAssets = assetsByStatus.find((a) => a.status === "stolen")?.count ?? 0;
  const maintenanceAssets = assetsByStatus.find((a) => a.status === "maintenance")?.count ?? 0;

  return {
    companyId,
    companyName: company.name,
    status: company.status,
    assets: {
      byStatus: Object.fromEntries(assetsByStatus.map((a) => [a.status, a.count])),
      issues: { lost: lostAssets, stolen: stolenAssets, maintenance: maintenanceAssets },
    },
    rentals: {
      byStatus: Object.fromEntries(rentalsByStatus.map((r) => [r.status, r.count])),
      issues: { overdue: overdueRentals, disputed: disputedRentals },
    },
  };
}

export async function getTenantSummary(companyId: string) {
  const detail = await getPlatformCompanyDetail(companyId);
  const health = await getCompanyHealthSummary(companyId);

  const recentAudit = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.companyId, companyId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5);

  return {
    company: {
      id: detail.id,
      name: detail.name,
      slug: detail.slug,
      status: detail.status,
      email: detail.email,
      createdAt: detail.createdAt,
      moderatedAt: detail.moderatedAt,
      moderationReasonCode: detail.moderationReasonCode,
    },
    counts: detail.counts,
    health: health.assets.issues,
    rentalIssues: health.rentals.issues,
    recentActivity: recentAudit.map((a) => ({
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: a.createdAt,
    })),
  };
}

export async function getTenantAuditLog(companyId: string, opts: { page?: number; limit?: number }) {
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) throw new NotFoundError("Company not found");

  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const [totalResult] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(eq(auditLogs.companyId, companyId));

  const items = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.companyId, companyId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: {
      page,
      limit,
      total: totalResult?.count ?? 0,
      totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
    },
  };
}

export async function getTenantHealth(companyId: string) {
  return getCompanyHealthSummary(companyId);
}
