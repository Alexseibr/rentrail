import {
  db,
  companyWhiteLabelSettings,
  companies,
  saasPlans,
  saasSubscriptions,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

export async function getWhiteLabelSettings(companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) throw new NotFoundError("Company not found");

  const [settings] = await db
    .select()
    .from(companyWhiteLabelSettings)
    .where(eq(companyWhiteLabelSettings.companyId, companyId))
    .limit(1);

  return settings ?? null;
}

export async function upsertWhiteLabelSettings(
  companyId: string,
  input: Partial<{
    customDomain: string | null;
    brandNameOverride: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    customSupportEmail: string | null;
    customSupportPhone: string | null;
    notes: string | null;
  }>,
) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) throw new NotFoundError("Company not found");

  const existing = await getWhiteLabelSettings(companyId);

  if (existing) {
    const [updated] = await db
      .update(companyWhiteLabelSettings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(companyWhiteLabelSettings.companyId, companyId))
      .returning();
    return { settings: updated, previous: existing };
  }

  const [created] = await db
    .insert(companyWhiteLabelSettings)
    .values({ companyId, ...input })
    .returning();
  return { settings: created, previous: null };
}

async function checkWhiteLabelEligibility(companyId: string): Promise<boolean> {
  const rows = await db
    .select({ whiteLabelAvailable: saasPlans.whiteLabelAvailable })
    .from(saasSubscriptions)
    .innerJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(
      and(
        eq(saasSubscriptions.companyId, companyId),
        sql`${saasSubscriptions.status} IN ('trial', 'active')`,
      ),
    )
    .limit(1);

  return rows.length > 0 && rows[0].whiteLabelAvailable;
}

export async function enableWhiteLabel(companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) throw new NotFoundError("Company not found");

  const eligible = await checkWhiteLabelEligibility(companyId);
  if (!eligible) {
    throw new AppError(
      422,
      "White-label is not available on the current plan",
      "PLAN_NOT_ELIGIBLE",
    );
  }

  const existing = await getWhiteLabelSettings(companyId);

  if (existing) {
    if (existing.status === "enabled") {
      return { settings: existing, previous: existing };
    }
    const [updated] = await db
      .update(companyWhiteLabelSettings)
      .set({ status: "enabled", enabledAt: new Date(), updatedAt: new Date() })
      .where(eq(companyWhiteLabelSettings.companyId, companyId))
      .returning();
    return { settings: updated, previous: existing };
  }

  const [created] = await db
    .insert(companyWhiteLabelSettings)
    .values({ companyId, status: "enabled", enabledAt: new Date() })
    .returning();
  return { settings: created, previous: null };
}

export async function disableWhiteLabel(companyId: string) {
  const existing = await getWhiteLabelSettings(companyId);
  if (!existing) throw new NotFoundError("White-label settings not found");

  const [updated] = await db
    .update(companyWhiteLabelSettings)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(companyWhiteLabelSettings.companyId, companyId))
    .returning();

  return { settings: updated, previous: existing };
}
