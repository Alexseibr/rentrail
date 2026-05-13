import {
  db,
  companies,
  branches,
  stations,
  assets,
  users,
  rentals,
  clients,
  userCompanyMemberships,
  auditLogs,
  companyModerationEvents,
  blacklistEntries,
  companyModules,
  roles,
} from "@workspace/db";
import { eq, and, ilike, or, desc, asc, count, sql, isNull } from "drizzle-orm";
import {
  NotFoundError,
  AppError,
  InvalidStatusTransitionError,
} from "../lib/errors";

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

const ACTION_ALLOWED_FROM: Record<string, string[]> = {
  approve: ["pending", "trial"],
  block: ["pending", "trial", "active", "past_due", "suspended"],
  unblock: ["blocked"],
  suspend: ["trial", "active", "past_due"],
  cancel: ["pending", "trial", "active", "past_due", "suspended", "blocked"],
};

function validateModerationTransition(
  from: string,
  to: string,
  action?: string,
) {
  const allowed = MODERATION_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidStatusTransitionError(from, to, "company");
  }
  if (action) {
    const actionAllowed = ACTION_ALLOWED_FROM[action];
    if (actionAllowed && !actionAllowed.includes(from)) {
      throw new AppError(
        409,
        `Action '${action}' is not allowed from status '${from}'`,
        "INVALID_ACTION_FOR_STATUS",
      );
    }
  }
}

export interface PlatformCompanyListOptions {
  search?: string;
  status?: string;
  plan?: string;
  hasModeration?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "slug" | "status" | "country" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export async function listPlatformCompanies(opts: PlatformCompanyListOptions) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];

  if (opts.status) {
    conditions.push(eq(companies.status, opts.status as CompanyStatus));
  }

  if (opts.hasModeration === "true") {
    conditions.push(
      sql`${companies.moderatedAt} IS NOT NULL` as ReturnType<typeof eq>,
    );
  }

  if (opts.plan) {
    conditions.push(
      sql`${companies.plan} = ${opts.plan}` as ReturnType<typeof eq>,
    );
  }

  let ownerCompanyIds: string[] | undefined;
  if (opts.search) {
    const ownerMatches = await db
      .select({ companyId: userCompanyMemberships.companyId })
      .from(userCompanyMemberships)
      .innerJoin(users, eq(users.id, userCompanyMemberships.userId))
      .innerJoin(roles, eq(roles.id, userCompanyMemberships.roleId))
      .where(
        and(
          eq(roles.name, "owner"),
          or(
            ilike(users.firstName, `%${opts.search}%`),
            ilike(users.lastName, `%${opts.search}%`),
            ilike(users.email, `%${opts.search}%`),
          ),
        ),
      );
    ownerCompanyIds = ownerMatches.map((m) => m.companyId);
  }

  const searchConditions = opts.search
    ? or(
        ilike(companies.name, `%${opts.search}%`),
        ilike(companies.slug, `%${opts.search}%`),
        ilike(companies.email, `%${opts.search}%`),
        ...(ownerCompanyIds && ownerCompanyIds.length > 0
          ? [
              sql`${companies.id} = ANY(${ownerCompanyIds})` as ReturnType<
                typeof eq
              >,
            ]
          : []),
      )
    : undefined;

  const baseWhere =
    conditions.length > 0
      ? and(...conditions, searchConditions)
      : searchConditions;

  const [totalResult] = await db
    .select({ count: count() })
    .from(companies)
    .where(baseWhere ?? undefined);

  const total = totalResult?.count ?? 0;

  const sortColumnMap = {
    name: companies.name,
    slug: companies.slug,
    status: companies.status,
    country: companies.country,
    createdAt: companies.createdAt,
  } as const;
  const sortCol = opts.sortBy
    ? sortColumnMap[opts.sortBy]
    : companies.createdAt;
  const sortDir = opts.sortOrder === "asc" ? asc : desc;

  const rows = await db
    .select()
    .from(companies)
    .where(baseWhere ?? undefined)
    .orderBy(sortDir(sortCol))
    .limit(limit)
    .offset(offset);

  const companyIds = rows.map((r) => r.id);

  const countsPromises =
    companyIds.length > 0
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
    counts: countsMap.get(row.id) ?? {
      branches: 0,
      stations: 0,
      assets: 0,
      users: 0,
      rentals: 0,
    },
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

  const [branchCount] = await db
    .select({ count: count() })
    .from(branches)
    .where(eq(branches.companyId, companyId));
  const [stationCount] = await db
    .select({ count: count() })
    .from(stations)
    .where(eq(stations.companyId, companyId));
  const [assetCount] = await db
    .select({ count: count() })
    .from(assets)
    .where(eq(assets.companyId, companyId));
  const [userCount] = await db
    .select({ count: count() })
    .from(userCompanyMemberships)
    .where(eq(userCompanyMemberships.companyId, companyId));
  const [clientCount] = await db
    .select({ count: count() })
    .from(clients)
    .where(eq(clients.companyId, companyId));
  const [rentalCount] = await db
    .select({ count: count() })
    .from(rentals)
    .where(eq(rentals.companyId, companyId));
  const [activeRentalCount] = await db
    .select({ count: count() })
    .from(rentals)
    .where(and(eq(rentals.companyId, companyId), eq(rentals.status, "active")));
  const [blacklistCount] = await db
    .select({ count: count() })
    .from(blacklistEntries)
    .where(eq(blacklistEntries.companyId, companyId));

  const ownerRole = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, "owner"))
    .limit(1);

  let ownerMembers: {
    userId: string;
    email: string | null;
    firstName: string;
    lastName: string;
  }[] = [];
  if (ownerRole.length > 0) {
    ownerMembers = await db
      .select({
        userId: userCompanyMemberships.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(userCompanyMemberships)
      .innerJoin(users, eq(users.id, userCompanyMemberships.userId))
      .where(
        and(
          eq(userCompanyMemberships.companyId, companyId),
          eq(userCompanyMemberships.roleId, ownerRole[0].id),
        ),
      );
  }

  const moderationHistory = await db
    .select()
    .from(companyModerationEvents)
    .where(eq(companyModerationEvents.companyId, companyId))
    .orderBy(desc(companyModerationEvents.createdAt))
    .limit(10);

  const recentActivity = await db
    .select({
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.companyId, companyId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5);

  const enabledModules = await db
    .select({
      moduleCode: companyModules.moduleCode,
      enabled: companyModules.enabled,
      enabledAt: companyModules.enabledAt,
    })
    .from(companyModules)
    .where(eq(companyModules.companyId, companyId));

  return {
    ...company,
    owners: ownerMembers.map((o) => ({
      userId: o.userId,
      email: o.email,
      name: `${o.firstName} ${o.lastName}`,
    })),
    counts: {
      branches: branchCount?.count ?? 0,
      stations: stationCount?.count ?? 0,
      assets: assetCount?.count ?? 0,
      users: userCount?.count ?? 0,
      clients: clientCount?.count ?? 0,
      rentals: rentalCount?.count ?? 0,
      activeRentals: activeRentalCount?.count ?? 0,
      blacklistEntries: blacklistCount?.count ?? 0,
    },
    modules: enabledModules,
    subscription: null,
    moderationHistory,
    recentActivity,
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

  validateModerationTransition(company.status, targetStatus, actionName);

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

export async function approveCompany(
  companyId: string,
  input: ModerationActionInput,
) {
  return performModerationAction(companyId, "active", "approve", input);
}

export async function blockCompany(
  companyId: string,
  input: ModerationActionInput,
) {
  return performModerationAction(companyId, "blocked", "block", input);
}

export async function unblockCompany(
  companyId: string,
  input: ModerationActionInput,
) {
  return performModerationAction(companyId, "active", "unblock", input);
}

export async function suspendCompany(
  companyId: string,
  input: ModerationActionInput,
) {
  return performModerationAction(companyId, "suspended", "suspend", input);
}

export async function cancelCompany(
  companyId: string,
  input: ModerationActionInput,
) {
  return performModerationAction(companyId, "canceled", "cancel", input);
}

export async function getCompanyUsage(companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) throw new NotFoundError("Company not found");

  const [branchCount] = await db
    .select({ count: count() })
    .from(branches)
    .where(eq(branches.companyId, companyId));
  const [stationCount] = await db
    .select({ count: count() })
    .from(stations)
    .where(eq(stations.companyId, companyId));
  const [assetCount] = await db
    .select({ count: count() })
    .from(assets)
    .where(eq(assets.companyId, companyId));
  const [userCount] = await db
    .select({ count: count() })
    .from(userCompanyMemberships)
    .where(eq(userCompanyMemberships.companyId, companyId));
  const [rentalCount] = await db
    .select({ count: count() })
    .from(rentals)
    .where(eq(rentals.companyId, companyId));

  const { getPlanLimitsForCompany } = await import("./billing.service");
  const planLimits = await getPlanLimitsForCompany(companyId);
  const limits = planLimits.limits;

  return {
    companyId,
    companyName: company.name,
    plan: company.plan ?? "none",
    resources: {
      branches: {
        current: branchCount?.count ?? 0,
        limit: limits.branches ?? -1,
      },
      stations: {
        current: stationCount?.count ?? 0,
        limit: limits.stations ?? -1,
      },
      assets: { current: assetCount?.count ?? 0, limit: limits.assets ?? -1 },
      users: { current: userCount?.count ?? 0, limit: limits.users ?? -1 },
      rentals: {
        current: rentalCount?.count ?? 0,
        limit: limits.rentals ?? -1,
      },
    },
  };
}

export async function getCompanyHealthSummary(companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
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

  const now = new Date();
  const [activeBlacklistCount] = await db
    .select({ count: count() })
    .from(blacklistEntries)
    .where(
      and(
        eq(blacklistEntries.companyId, companyId),
        sql`${blacklistEntries.startsAt} <= ${now}`,
        or(
          isNull(blacklistEntries.endsAt),
          sql`${blacklistEntries.endsAt} > ${now}`,
        ),
      ),
    );

  const overdueRentals =
    rentalsByStatus.find((r) => r.status === "overdue")?.count ?? 0;
  const disputedRentals =
    rentalsByStatus.find((r) => r.status === "disputed")?.count ?? 0;
  const lostAssets =
    assetsByStatus.find((a) => a.status === "lost")?.count ?? 0;
  const stolenAssets =
    assetsByStatus.find((a) => a.status === "stolen")?.count ?? 0;
  const maintenanceAssets =
    assetsByStatus.find((a) => a.status === "maintenance")?.count ?? 0;
  const blockedAssets =
    assetsByStatus.find((a) => a.status === "blocked")?.count ?? 0;

  return {
    companyId,
    companyName: company.name,
    status: company.status,
    assets: {
      byStatus: Object.fromEntries(
        assetsByStatus.map((a) => [a.status, a.count]),
      ),
      issues: {
        lost: lostAssets,
        stolen: stolenAssets,
        maintenance: maintenanceAssets,
        blocked: blockedAssets,
      },
    },
    rentals: {
      byStatus: Object.fromEntries(
        rentalsByStatus.map((r) => [r.status, r.count]),
      ),
      issues: { overdue: overdueRentals, disputed: disputedRentals },
    },
    incidents: {
      activeBlacklistEntries: activeBlacklistCount?.count ?? 0,
      lostOrStolenAssets: lostAssets + stolenAssets,
      overdueRentals,
      disputedRentals,
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

export async function getTenantAuditLog(
  companyId: string,
  opts: { page?: number; limit?: number },
) {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
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
