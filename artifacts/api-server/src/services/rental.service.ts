import { db, rentals, rentalStatusHistory, assets, type InsertRental } from "@workspace/db";
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

async function changeRentalStatus(
  rentalId: string,
  companyId: string,
  newStatus: string,
  changedBy?: string,
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

  if (newStatus === "active" && !rental.startDate) {
    updateData.startDate = new Date();
  }
  if (newStatus === "completed" || newStatus === "canceled") {
    updateData.actualEndDate = new Date();
  }

  const [updated] = await db
    .update(rentals)
    .set(updateData)
    .where(eq(rentals.id, rentalId))
    .returning();

  await db.insert(rentalStatusHistory).values({
    rentalId,
    previousStatus: rental.status,
    newStatus: newStatus as typeof rental.status,
    changedBy: changedBy ?? null,
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
  const [rental] = await db.insert(rentals).values(data).returning();

  await db.insert(rentalStatusHistory).values({
    rentalId: rental.id,
    newStatus: rental.status,
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
      expectedEndDate: newEndDate,
      updatedAt: new Date(),
    })
    .where(eq(rentals.id, id))
    .returning();

  await db.insert(rentalStatusHistory).values({
    rentalId: id,
    previousStatus: rental.status,
    newStatus: "extended",
    changedBy: userId ?? null,
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
