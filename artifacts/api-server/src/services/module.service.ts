import { db, companyModules } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const ALL_MODULES = [
  "public_page",
  "inquiries",
  "b2b_requests",
  "rentals",
  "payments",
  "blacklist",
  "incidents",
  "maintenance",
  "telemetry",
  "batteries",
  "notifications",
] as const;

const PLATFORM_MANAGED_MODULES = ["telemetry", "batteries"];

export type ModuleCode = typeof ALL_MODULES[number];

export function getAllModuleCodes() {
  return [...ALL_MODULES];
}

export async function getCompanyModules(companyId: string) {
  const rows = await db
    .select()
    .from(companyModules)
    .where(eq(companyModules.companyId, companyId));

  const result: Record<string, boolean> = {};
  for (const code of ALL_MODULES) {
    const row = rows.find((r) => r.moduleCode === code);
    result[code] = row?.enabled ?? false;
  }
  return result;
}

export async function isModuleEnabled(companyId: string, moduleCode: string): Promise<boolean> {
  const [row] = await db
    .select({ enabled: companyModules.enabled })
    .from(companyModules)
    .where(and(eq(companyModules.companyId, companyId), eq(companyModules.moduleCode, moduleCode)))
    .limit(1);

  return row?.enabled ?? false;
}

export async function updateCompanyModules(companyId: string, modules: Record<string, boolean>, isSuperAdmin = false) {
  for (const [code, enabled] of Object.entries(modules)) {
    if (!ALL_MODULES.includes(code as ModuleCode)) continue;
    if (!isSuperAdmin && PLATFORM_MANAGED_MODULES.includes(code)) continue;

    const [existing] = await db
      .select()
      .from(companyModules)
      .where(and(eq(companyModules.companyId, companyId), eq(companyModules.moduleCode, code)))
      .limit(1);

    if (existing) {
      await db
        .update(companyModules)
        .set({
          enabled,
          enabledAt: enabled ? new Date() : existing.enabledAt,
          disabledAt: !enabled ? new Date() : existing.disabledAt,
          updatedAt: new Date(),
        })
        .where(eq(companyModules.id, existing.id));
    } else {
      await db.insert(companyModules).values({
        companyId,
        moduleCode: code,
        enabled,
        enabledAt: enabled ? new Date() : null,
      });
    }
  }

  return getCompanyModules(companyId);
}
