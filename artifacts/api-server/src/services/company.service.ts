import { db, companies, userCompanyMemberships, type InsertCompany } from "@workspace/db";
import { eq } from "drizzle-orm";
import { NotFoundError, ConflictError } from "../lib/errors";

export async function createCompany(data: InsertCompany) {
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, data.slug))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Company slug already exists");
  }

  const [company] = await db.insert(companies).values(data).returning();
  return company;
}

export async function getCompany(id: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);

  if (!company) {
    throw new NotFoundError("Company not found");
  }
  return company;
}

export async function updateCompany(id: string, data: Partial<InsertCompany>) {
  const [company] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();

  if (!company) {
    throw new NotFoundError("Company not found");
  }
  return company;
}

export async function listCompanies() {
  return db.select().from(companies);
}

export async function listUserCompanies(userId: string) {
  const memberships = await db
    .select({ companyId: userCompanyMemberships.companyId })
    .from(userCompanyMemberships)
    .where(eq(userCompanyMemberships.userId, userId));

  if (memberships.length === 0) return [];

  const companyIds = memberships.map((m) => m.companyId);
  const result = await db.select().from(companies);
  return result.filter((c) => companyIds.includes(c.id));
}

export async function userHasCompanyAccess(userId: string, companyId: string): Promise<boolean> {
  const [membership] = await db
    .select({ id: userCompanyMemberships.id })
    .from(userCompanyMemberships)
    .where(
      eq(userCompanyMemberships.userId, userId),
    )
    .limit(1);

  return !!membership;
}
