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
  const [activeTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "active"));
  const [trialTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "trial"));
  const [pendingTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "pending"));
  const [blockedTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "blocked"));
  const [suspendedTenants] = await db.select({ count: count() }).from(companies).where(eq(companies.status, "suspended"));

  const [totalAssets] = await db.select({ count: count() }).from(assets);
  const [activeAssets] = await db.select({ count: count() }).from(assets).where(
    sql`${assets.status} IN ('available', 'reserved', 'awaiting_pickup', 'rented')`,
  );

  const [totalDevices] = await db.select({ count: count() }).from(devices);
  const [offlineDevices] = await db.select({ count: count() }).from(devices).where(eq(devices.status, "offline"));

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
    build: {
      version: process.env.APP_VERSION ?? "dev",
      nodeVersion: process.version,
      env: process.env.NODE_ENV ?? "development",
      uptime: process.uptime(),
    },
  };
}

export async function getTenantHealthList() {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      status: companies.status,
      plan: companies.plan,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .orderBy(companies.name);

  const enriched = [];
  for (const row of rows) {
    const [assetCount] = await db.select({ count: count() }).from(assets).where(eq(assets.companyId, row.id));
    const [deviceCount] = await db.select({ count: count() }).from(devices).where(eq(devices.companyId, row.id));
    const [offlineCount] = await db.select({ count: count() }).from(devices).where(and(eq(devices.companyId, row.id), eq(devices.status, "offline")));

    let healthStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    const totalDevices = deviceCount?.count ?? 0;
    const offlineDevices = offlineCount?.count ?? 0;
    if (totalDevices > 0 && offlineDevices / totalDevices > 0.5) healthStatus = "unhealthy";
    else if (totalDevices > 0 && offlineDevices / totalDevices > 0.2) healthStatus = "degraded";

    enriched.push({
      ...row,
      assets: assetCount?.count ?? 0,
      devices: totalDevices,
      offlineDevices,
      healthStatus,
    });
  }

  return enriched;
}

export function getServiceStatus(serviceName: string) {
  const serviceStubs: Record<string, { name: string; status: string; message: string; lastChecked: string }> = {
    email: { name: "Email Service", status: "not_configured", message: "Email integration not configured", lastChecked: new Date().toISOString() },
    storage: { name: "Object Storage", status: "ok", message: "GCS object storage available", lastChecked: new Date().toISOString() },
    queues: { name: "Job Queue", status: "not_configured", message: "Queue service not configured", lastChecked: new Date().toISOString() },
    "telemetry-ingest": { name: "Telemetry Ingest", status: "ok", message: "M2M telemetry ingest available via provider API keys", lastChecked: new Date().toISOString() },
    "mobile-push": { name: "Mobile Push", status: "not_configured", message: "Push notification service not configured", lastChecked: new Date().toISOString() },
  };

  const service = serviceStubs[serviceName];
  if (!service) return null;
  return service;
}

export function getAllServiceStatuses() {
  const services = ["email", "storage", "queues", "telemetry-ingest", "mobile-push"];
  return services.map((s) => getServiceStatus(s)!);
}
