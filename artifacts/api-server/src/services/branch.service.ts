import { db, branches, type InsertBranch } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "../lib/errors";

export async function createBranch(data: InsertBranch) {
  const [branch] = await db.insert(branches).values(data).returning();
  return branch;
}

export async function getBranch(id: string, companyId: string) {
  const [branch] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.id, id), eq(branches.companyId, companyId)))
    .limit(1);

  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
  return branch;
}

export async function updateBranch(id: string, companyId: string, data: Partial<InsertBranch>) {
  const [branch] = await db
    .update(branches)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(branches.id, id), eq(branches.companyId, companyId)))
    .returning();

  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
  return branch;
}

export async function listBranches(companyId: string) {
  return db
    .select()
    .from(branches)
    .where(eq(branches.companyId, companyId));
}
