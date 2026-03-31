import {
  db,
  companies,
  assets,
  branches,
  rentals,
  blacklistEntries,
  saasSubscriptions,
  saasPlans,
  saasInvoices,
  userCompanyMemberships,
} from "@workspace/db";
import { eq, count, sql, desc, and, gte } from "drizzle-orm";

export async function getOverview() {
  const [totalTenants] = await db.select({ count: count() }).from(companies);
  const [activeTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "active"));
  const [trialTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "trial"));
  const [pendingTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "pending"));
  const [blockedTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "blocked"));
  const [suspendedTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "suspended"));
  const [totalAssets] = await db.select({ count: count() }).from(assets);
  const [totalRentals] = await db.select({ count: count() }).from(rentals);
  const [totalUsers] = await db.select({ count: count() }).from(userCompanyMemberships);

  const mrrRows = await db
    .select({ price: saasPlans.price })
    .from(saasSubscriptions)
    .innerJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(sql`${saasSubscriptions.status} IN ('active', 'trial')`);
  const mrrEstimate = mrrRows.reduce((sum, r) => sum + r.price, 0);

  const planDistribution = await db
    .select({
      planName: saasPlans.name,
      planCode: saasPlans.code,
      count: count(),
    })
    .from(saasSubscriptions)
    .innerJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(sql`${saasSubscriptions.status} IN ('active', 'trial')`)
    .groupBy(saasPlans.name, saasPlans.code);

  return {
    totalCompanies: totalTenants?.count ?? 0,
    activeCompanies: activeTenants?.count ?? 0,
    trialCompanies: trialTenants?.count ?? 0,
    pendingCompanies: pendingTenants?.count ?? 0,
    blockedCompanies: blockedTenants?.count ?? 0,
    suspendedCompanies: suspendedTenants?.count ?? 0,
    totalAssets: totalAssets?.count ?? 0,
    totalRentals: totalRentals?.count ?? 0,
    totalUsers: totalUsers?.count ?? 0,
    mrrEstimate,
    planDistribution,
  };
}

export async function getTopTenants(metric: "rentals" | "assets" = "rentals", limit = 10) {
  if (metric === "assets") {
    const rows = await db
      .select({
        companyId: companies.id,
        companyName: companies.name,
        count: count(),
      })
      .from(assets)
      .innerJoin(companies, eq(companies.id, assets.companyId))
      .groupBy(companies.id, companies.name)
      .orderBy(desc(count()))
      .limit(limit);

    return { metric, items: rows };
  }

  const rows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      count: count(),
    })
    .from(rentals)
    .innerJoin(companies, eq(companies.id, rentals.companyId))
    .groupBy(companies.id, companies.name)
    .orderBy(desc(count()))
    .limit(limit);

  return { metric, items: rows };
}

export async function getBillingMetrics() {
  const [overdueInvoices] = await db
    .select({ count: count() })
    .from(saasInvoices)
    .where(eq(saasInvoices.status, "overdue"));

  const [issuedInvoices] = await db
    .select({ count: count() })
    .from(saasInvoices)
    .where(eq(saasInvoices.status, "issued"));

  const [paidInvoices] = await db
    .select({ count: count() })
    .from(saasInvoices)
    .where(eq(saasInvoices.status, "paid"));

  const revenueResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${saasInvoices.amount}), 0)` })
    .from(saasInvoices)
    .where(eq(saasInvoices.status, "paid"));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRevenueResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${saasInvoices.amount}), 0)` })
    .from(saasInvoices)
    .where(and(eq(saasInvoices.status, "paid"), gte(saasInvoices.paidAt, thirtyDaysAgo)));

  return {
    invoices: {
      overdue: overdueInvoices?.count ?? 0,
      issued: issuedInvoices?.count ?? 0,
      paid: paidInvoices?.count ?? 0,
    },
    revenue: {
      totalCollected: revenueResult[0]?.total ?? 0,
      last30Days: recentRevenueResult[0]?.total ?? 0,
    },
  };
}

export async function getUsageMetrics() {
  const [totalCompanies] = await db.select({ count: count() }).from(companies);
  const total = totalCompanies?.count ?? 0;

  if (total === 0) {
    return {
      totalCompanies: 0,
      averages: { assetsPerTenant: 0, branchesPerTenant: 0, usersPerTenant: 0, rentalsPerTenant: 0 },
    };
  }

  const [totalAssets] = await db.select({ count: count() }).from(assets);
  const [totalBranches] = await db.select({ count: count() }).from(branches);
  const [totalUsers] = await db.select({ count: count() }).from(userCompanyMemberships);
  const [totalRentals] = await db.select({ count: count() }).from(rentals);

  return {
    totalCompanies: total,
    averages: {
      assetsPerTenant: Math.round((totalAssets?.count ?? 0) / total * 10) / 10,
      branchesPerTenant: Math.round((totalBranches?.count ?? 0) / total * 10) / 10,
      usersPerTenant: Math.round((totalUsers?.count ?? 0) / total * 10) / 10,
      rentalsPerTenant: Math.round((totalRentals?.count ?? 0) / total * 10) / 10,
    },
  };
}

export async function getRiskMetrics() {
  const [totalBlacklistEntries] = await db.select({ count: count() }).from(blacklistEntries);
  const [activeBlacklist] = await db
    .select({ count: count() })
    .from(blacklistEntries)
    .where(sql`(${blacklistEntries.endsAt} IS NULL OR ${blacklistEntries.endsAt} > NOW())`);

  const [globalBlacklist] = await db
    .select({ count: count() })
    .from(blacklistEntries)
    .where(and(eq(blacklistEntries.scopeType, "global"), sql`(${blacklistEntries.endsAt} IS NULL OR ${blacklistEntries.endsAt} > NOW())`));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [recentBlacklist] = await db
    .select({ count: count() })
    .from(blacklistEntries)
    .where(gte(blacklistEntries.createdAt, thirtyDaysAgo));

  const [disputedRentals] = await db
    .select({ count: count() })
    .from(rentals)
    .where(eq(rentals.status, "disputed"));

  const [overdueRentals] = await db
    .select({ count: count() })
    .from(rentals)
    .where(eq(rentals.status, "overdue"));

  return {
    blacklist: {
      total: totalBlacklistEntries?.count ?? 0,
      active: activeBlacklist?.count ?? 0,
      global: globalBlacklist?.count ?? 0,
      last30Days: recentBlacklist?.count ?? 0,
    },
    incidents: {
      disputedRentals: disputedRentals?.count ?? 0,
      overdueRentals: overdueRentals?.count ?? 0,
    },
  };
}
