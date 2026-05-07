import {
  db,
  companies,
  assets,
  devices,
  saasSubscriptions,
  saasPlans,
} from "@workspace/db";
import { eq, count, sql, and } from "drizzle-orm";

export async function getPlatformHealthSummary() {
  const [totalTenants] = await db.select({ count: count() }).from(companies);
  const [activeTenants] = await db
    .select({ count: count() })
    .from(companies)
    .where(eq(companies.status, "active"));
  const [trialTenants] = await db
    .select({ count: count() })
    .from(companies)
    .where(eq(companies.status, "trial"));
  const [pendingTenants] = await db
    .select({ count: count() })
    .from(companies)
    .where(eq(companies.status, "pending"));
  const [blockedTenants] = await db
    .select({ count: count() })
    .from(companies)
    .where(eq(companies.status, "blocked"));
  const [suspendedTenants] = await db
    .select({ count: count() })
    .from(companies)
    .where(eq(companies.status, "suspended"));

  const [totalAssets] = await db.select({ count: count() }).from(assets);
  const [activeAssets] = await db
    .select({ count: count() })
    .from(assets)
    .where(
      sql`${assets.status} IN ('available', 'reserved', 'awaiting_pickup', 'rented')`,
    );

  const [totalDevices] = await db.select({ count: count() }).from(devices);
  const [offlineDevices] = await db
    .select({ count: count() })
    .from(devices)
    .where(eq(devices.status, "offline"));

  const mrrRows = await db
    .select({ price: saasPlans.price })
    .from(saasSubscriptions)
    .innerJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(sql`${saasSubscriptions.status} IN ('active', 'trial')`);
  const mrrEstimate = mrrRows.reduce((sum, r) => sum + r.price, 0);

  return {
    tenants: {
      total: totalTenants?.count ?? 0,
      active: activeTenants?.count ?? 0,
      trial: trialTenants?.count ?? 0,
      pending: pendingTenants?.count ?? 0,
      blocked: blockedTenants?.count ?? 0,
      suspended: suspendedTenants?.count ?? 0,
    },
    assets: {
      total: totalAssets?.count ?? 0,
      active: activeAssets?.count ?? 0,
    },
    devices: {
      total: totalDevices?.count ?? 0,
      offline: offlineDevices?.count ?? 0,
    },
    mrrEstimate,
    services: getAllServiceStatuses(),
    build: {
      version: process.env.APP_VERSION ?? "dev",
      nodeVersion: process.version,
      env: process.env.NODE_ENV ?? "development",
      uptime: process.uptime(),
    },
  };
}

export async function getTenantHealthList() {
  const assetCounts = db
    .select({
      companyId: assets.companyId,
      count: count().as("asset_count"),
    })
    .from(assets)
    .groupBy(assets.companyId)
    .as("asset_counts");

  const deviceCounts = db
    .select({
      companyId: devices.companyId,
      total: count().as("device_total"),
      offline:
        sql<number>`COUNT(*) FILTER (WHERE ${devices.status} = 'offline')`.as(
          "device_offline",
        ),
    })
    .from(devices)
    .groupBy(devices.companyId)
    .as("device_counts");

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      status: companies.status,
      plan: companies.plan,
      createdAt: companies.createdAt,
      assets: sql<number>`COALESCE(${assetCounts.count}, 0)`.mapWith(Number),
      devices: sql<number>`COALESCE(${deviceCounts.total}, 0)`.mapWith(Number),
      offlineDevices: sql<number>`COALESCE(${deviceCounts.offline}, 0)`.mapWith(
        Number,
      ),
    })
    .from(companies)
    .leftJoin(assetCounts, eq(assetCounts.companyId, companies.id))
    .leftJoin(deviceCounts, eq(deviceCounts.companyId, companies.id))
    .orderBy(companies.name);

  return rows.map((row) => {
    let healthStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (row.devices > 0 && row.offlineDevices / row.devices > 0.5)
      healthStatus = "unhealthy";
    else if (row.devices > 0 && row.offlineDevices / row.devices > 0.2)
      healthStatus = "degraded";

    return { ...row, healthStatus };
  });
}

export function getServiceStatus(serviceName: string) {
  const serviceStubs: Record<
    string,
    { name: string; status: string; message: string; lastChecked: string }
  > = {
    email: {
      name: "Email Service",
      status: "not_configured",
      message: "Email integration not configured",
      lastChecked: new Date().toISOString(),
    },
    storage: {
      name: "Object Storage",
      status: "ok",
      message: "GCS object storage available",
      lastChecked: new Date().toISOString(),
    },
    queues: {
      name: "Job Queue",
      status: "not_configured",
      message: "Queue service not configured",
      lastChecked: new Date().toISOString(),
    },
    "telemetry-ingest": {
      name: "Telemetry Ingest",
      status: "ok",
      message: "M2M telemetry ingest available via provider API keys",
      lastChecked: new Date().toISOString(),
    },
    "mobile-push": {
      name: "Mobile Push",
      status: "not_configured",
      message: "Push notification service not configured",
      lastChecked: new Date().toISOString(),
    },
  };

  const service = serviceStubs[serviceName];
  if (!service) return null;
  return service;
}

export function getAllServiceStatuses() {
  const services = [
    "email",
    "storage",
    "queues",
    "telemetry-ingest",
    "mobile-push",
  ];
  return services.map((s) => getServiceStatus(s)!);
}
