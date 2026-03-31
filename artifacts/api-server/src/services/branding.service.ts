import { db, companyBranding } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function getOrCreateBranding(companyId: string) {
  const [existing] = await db
    .select()
    .from(companyBranding)
    .where(eq(companyBranding.companyId, companyId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(companyBranding)
    .values({ companyId })
    .returning();
  return created;
}

export async function updateBranding(companyId: string, data: Partial<typeof companyBranding.$inferInsert>) {
  delete (data as Record<string, unknown>).companyId;
  delete (data as Record<string, unknown>).id;

  const existing = await getOrCreateBranding(companyId);

  const [updated] = await db
    .update(companyBranding)
    .set({ ...data, brandingUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(companyBranding.companyId, companyId))
    .returning();

  return updated;
}
