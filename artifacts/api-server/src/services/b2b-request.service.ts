import { db, b2bRequests } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

type B2BRequestStatus = typeof b2bRequests.$inferSelect.status;

const B2B_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ["in_review", "contacted", "rejected", "archived"],
  in_review: ["contacted", "negotiating", "rejected", "archived"],
  contacted: ["negotiating", "converted", "rejected", "archived"],
  negotiating: ["converted", "rejected", "archived"],
  converted: [],
  rejected: ["archived"],
  archived: [],
};

export async function createPublicB2BRequest(companyId: string, data: {
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  city?: string;
  requestedFleetSize?: number;
  assetTypes?: string[];
  message?: string;
}) {
  const [request] = await db.insert(b2bRequests).values({
    companyId,
    source: "public_b2b",
    companyName: data.companyName.trim(),
    contactPerson: data.contactPerson.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim().toLowerCase() ?? null,
    city: data.city?.trim() ?? null,
    requestedFleetSize: data.requestedFleetSize ?? null,
    assetTypes: data.assetTypes ?? null,
    message: data.message?.trim() ?? null,
  }).returning();
  return request;
}

export async function getB2BRequest(id: string, companyId: string) {
  const [request] = await db
    .select()
    .from(b2bRequests)
    .where(and(eq(b2bRequests.id, id), eq(b2bRequests.companyId, companyId)))
    .limit(1);
  if (!request) throw new NotFoundError("B2B request not found");
  return request;
}

export async function listB2BRequests(companyId: string, status?: string) {
  const conditions = [eq(b2bRequests.companyId, companyId)];
  if (status) {
    const validStatuses = ["new", "in_review", "contacted", "negotiating", "converted", "rejected", "archived"];
    if (!validStatuses.includes(status)) throw new AppError(400, "Invalid status filter", "INVALID_STATUS");
    conditions.push(eq(b2bRequests.status, status as B2BRequestStatus));
  }
  return db.select().from(b2bRequests).where(and(...conditions));
}

export async function updateB2BRequest(id: string, companyId: string, data: Partial<{ notesInternal: string; assignedToUserId: string }>) {
  const [updated] = await db
    .update(b2bRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(b2bRequests.id, id), eq(b2bRequests.companyId, companyId)))
    .returning();
  if (!updated) throw new NotFoundError("B2B request not found");
  return updated;
}

function validateTransition(from: string, to: string) {
  const allowed = B2B_STATUS_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AppError(422, `Cannot transition B2B request from '${from}' to '${to}'`, "INVALID_STATUS_TRANSITION");
  }
}

async function changeStatus(id: string, companyId: string, newStatus: string, userId?: string) {
  const request = await getB2BRequest(id, companyId);
  validateTransition(request.status, newStatus);

  const [updated] = await db
    .update(b2bRequests)
    .set({ status: newStatus as B2BRequestStatus, processedByUserId: userId ?? null, updatedAt: new Date() })
    .where(and(eq(b2bRequests.id, id), eq(b2bRequests.companyId, companyId)))
    .returning();
  return updated;
}

export async function markContacted(id: string, companyId: string, userId: string) {
  return changeStatus(id, companyId, "contacted", userId);
}

export async function convertB2BRequest(id: string, companyId: string, userId: string) {
  return changeStatus(id, companyId, "converted", userId);
}

export async function rejectB2BRequest(id: string, companyId: string, userId: string) {
  return changeStatus(id, companyId, "rejected", userId);
}
