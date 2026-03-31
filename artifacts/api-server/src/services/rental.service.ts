import { db, rentals, rentalStatusHistory, assets, clients, branches, type InsertRental } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

const RENTAL_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_approval", "awaiting_payment", "canceled"],
  pending_approval: ["awaiting_payment", "awaiting_pickup", "canceled"],
  awaiting_payment: ["awaiting_pickup", "canceled"],
  awaiting_pickup: ["active", "canceled"],
  active: ["extended", "overdue", "return_requested", "completed", "canceled"],
  extended: ["overdue", "return_requested", "completed", "canceled"],
  overdue: ["return_requested", "completed", "defaulted"],
  return_requested: ["completed"],
  completed: [],
  canceled: [],
  disputed: ["completed", "defaulted"],
  defaulted: [],
};

function validateStatusTransition(currentStatus: string, newStatus: string) {
  const allowed = RENTAL_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      422,
      `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      "INVALID_STATUS_TRANSITION",
    );
  }
}

async function validateRentalOwnership(companyId: string, clientId: string, assetId: string, branchId?: string | null) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)))
    .limit(1);
  if (!client) {
    throw new AppError(400, "Client does not belong to this company", "INVALID_CLIENT");
  }

  const [asset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId)))
    .limit(1);
  if (!asset) {
    throw new AppError(400, "Asset does not belong to this company", "INVALID_ASSET");
  }

  if (branchId) {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
      .limit(1);
    if (!branch) {
      throw new AppError(400, "Branch does not belong to this company", "INVALID_BRANCH");
    }
  }
}

async function changeRentalStatus(
  rentalId: string,
  companyId: string,
  newStatus: string,
  changedByUserId?: string,
  reason?: string,
) {
  const [rental] = await db
    .select()
    .from(rentals)
    .where(and(eq(rentals.id, rentalId), eq(rentals.companyId, companyId)))
    .limit(1);

  if (!rental) {
    throw new NotFoundError("Rental not found");
  }

  validateStatusTransition(rental.status, newStatus);

  const updateData: Record<string, unknown> = {
    status: newStatus as typeof rental.status,
    updatedAt: new Date(),
  };

  if (newStatus === "active" && !rental.startAt) {
    updateData.startAt = new Date();
  }
  if (newStatus === "completed" || newStatus === "canceled") {
    updateData.actualEndAt = new Date();
  }

  const [updated] = await db
    .update(rentals)
    .set(updateData)
    .where(eq(rentals.id, rentalId))
    .returning();

  await db.insert(rentalStatusHistory).values({
    companyId,
    rentalId,
    fromStatus: rental.status,
    toStatus: newStatus as typeof rental.status,
    changedByUserId: changedByUserId ?? null,
    reason: reason ?? null,
  });

  if (newStatus === "active") {
    await db
      .update(assets)
      .set({ status: "rented", updatedAt: new Date() })
      .where(eq(assets.id, rental.assetId));
  }
  if (newStatus === "completed" || newStatus === "canceled") {
    await db
      .update(assets)
      .set({ status: "available", updatedAt: new Date() })
      .where(eq(assets.id, rental.assetId));
  }

  return updated;
}

export async function createRental(data: InsertRental) {
  await validateRentalOwnership(data.companyId, data.clientId, data.assetId, data.branchId);

  const [rental] = await db.insert(rentals).values(data).returning();

  await db.insert(rentalStatusHistory).values({
    companyId: rental.companyId,
    rentalId: rental.id,
    toStatus: rental.status,
    reason: "Rental created",
  });

  return rental;
}

export async function getRental(id: string, companyId: string) {
  const [rental] = await db
    .select()
    .from(rentals)
    .where(and(eq(rentals.id, id), eq(rentals.companyId, companyId)))
    .limit(1);

  if (!rental) {
    throw new NotFoundError("Rental not found");
  }
  return rental;
}

export async function listRentals(companyId: string, status?: string) {
  const results = await db
    .select()
    .from(rentals)
    .where(eq(rentals.companyId, companyId));

  if (status) {
    return results.filter((r) => r.status === status);
  }
  return results;
}

export async function approveRental(id: string, companyId: string, userId?: string) {
  return changeRentalStatus(id, companyId, "awaiting_payment", userId, "Rental approved");
}

export async function startRental(id: string, companyId: string, userId?: string) {
  return changeRentalStatus(id, companyId, "active", userId, "Rental started");
}

export async function extendRental(id: string, companyId: string, newEndDate: Date, userId?: string) {
  const [rental] = await db
    .select()
    .from(rentals)
    .where(and(eq(rentals.id, id), eq(rentals.companyId, companyId)))
    .limit(1);

  if (!rental) {
    throw new NotFoundError("Rental not found");
  }

  validateStatusTransition(rental.status, "extended");

  const [updated] = await db
    .update(rentals)
    .set({
      status: "extended",
      plannedEndAt: newEndDate,
      updatedAt: new Date(),
    })
    .where(eq(rentals.id, id))
    .returning();

  await db.insert(rentalStatusHistory).values({
    companyId,
    rentalId: id,
    fromStatus: rental.status,
    toStatus: "extended",
    changedByUserId: userId ?? null,
    reason: `Extended to ${newEndDate.toISOString()}`,
  });

  return updated;
}

export async function completeRental(id: string, companyId: string, userId?: string) {
  return changeRentalStatus(id, companyId, "completed", userId, "Rental completed");
}

export async function cancelRental(id: string, companyId: string, userId?: string, reason?: string) {
  return changeRentalStatus(id, companyId, "canceled", userId, reason ?? "Rental canceled");
}
