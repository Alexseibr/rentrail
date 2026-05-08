import {
  db,
  rentals,
  rentalStatusHistory,
  assets,
  assetStatusHistory,
  clients,
  branches,
  stations,
  type InsertRental,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  NotFoundError,
  AppError,
  InvalidStatusTransitionError,
  AssetUnavailableError,
  BlacklistBlockedError,
} from "../lib/errors";
import {
  checkClientBlacklist,
} from "./blacklist.service";

type RentalStatus = typeof rentals.$inferSelect.status;
type AssetStatus = typeof assets.$inferSelect.status;

const ACTIVE_RENTAL_STATUSES: string[] = [
  "draft",
  "pending_approval",
  "awaiting_payment",
  "awaiting_pickup",
  "active",
  "extended",
  "overdue",
];

const ASSET_STATUSES_ALLOWED_FOR_RENTAL = ["available", "reserved"];
const ASSET_STATUSES_ALLOWED_FOR_START = [
  "available",
  "reserved",
  "awaiting_pickup",
];

const BLOCKING_BLACKLIST_ACTIONS = [
  "blocked_branch",
  "blocked_company",
  "blocked_global",
];

const RENTAL_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: [
    "pending_approval",
    "awaiting_payment",
    "awaiting_pickup",
    "canceled",
  ],
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

function validateTransition(from: string, to: string) {
  const allowed = RENTAL_STATUS_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidStatusTransitionError(from, to, "rental");
  }
}

async function getRentalOrThrow(id: string, companyId: string) {
  const [rental] = await db
    .select()
    .from(rentals)
    .where(and(eq(rentals.id, id), eq(rentals.companyId, companyId)))
    .limit(1);
  if (!rental) throw new NotFoundError("Rental not found");
  return rental;
}

async function writeRentalStatusHistory(
  companyId: string,
  rentalId: string,
  fromStatus: string | null,
  toStatus: string,
  changedByUserId?: string,
  reason?: string,
) {
  await db.insert(rentalStatusHistory).values({
    companyId,
    rentalId,
    fromStatus: fromStatus as RentalStatus,
    toStatus: toStatus as RentalStatus,
    changedByUserId: changedByUserId ?? null,
    reason: reason ?? null,
  });
}

async function writeAssetStatusHistory(
  companyId: string,
  assetId: string,
  fromStatus: string,
  toStatus: string,
  changedByUserId?: string,
  reason?: string,
) {
  await db.insert(assetStatusHistory).values({
    companyId,
    assetId,
    fromStatus: fromStatus as AssetStatus,
    toStatus: toStatus as AssetStatus,
    changedByUserId: changedByUserId ?? null,
    reason: reason ?? null,
  });
}

async function setAssetStatus(
  assetId: string,
  status: string,
  companyId: string,
  changedByUserId?: string,
  reason?: string,
) {
  const [current] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId)))
    .limit(1);
  if (!current) return;

  await db
    .update(assets)
    .set({ status: status as AssetStatus, updatedAt: new Date() })
    .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId)));
  await writeAssetStatusHistory(
    companyId,
    assetId,
    current.status,
    status,
    changedByUserId,
    reason,
  );
}

async function validateRentalOwnership(
  companyId: string,
  clientId: string,
  assetId: string,
  branchId?: string | null,
) {
  const [client] = await db
    .select({ id: clients.id, companyId: clients.companyId })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)))
    .limit(1);
  if (!client) {
    throw new AppError(
      400,
      "Client does not belong to this company",
      "INVALID_CLIENT",
    );
  }

  const [asset] = await db
    .select({
      id: assets.id,
      companyId: assets.companyId,
      status: assets.status,
      archivedAt: assets.archivedAt,
    })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId)))
    .limit(1);
  if (!asset) {
    throw new AppError(
      400,
      "Asset does not belong to this company",
      "INVALID_ASSET",
    );
  }
  if (asset.archivedAt) {
    throw new AssetUnavailableError("Cannot create rental for archived asset");
  }

  if (!ASSET_STATUSES_ALLOWED_FOR_RENTAL.includes(asset.status)) {
    throw new AssetUnavailableError(
      `Asset status '${asset.status}' is not available for new rentals. Must be: ${ASSET_STATUSES_ALLOWED_FOR_RENTAL.join(", ")}`,
    );
  }

  if (branchId) {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
      .limit(1);
    if (!branch) {
      throw new AppError(
        400,
        "Branch does not belong to this company",
        "INVALID_BRANCH",
      );
    }
  }
}

async function checkActiveRentalConflict(assetId: string, companyId: string) {
  const [existing] = await db
    .select({ id: rentals.id, status: rentals.status })
    .from(rentals)
    .where(
      and(
        eq(rentals.assetId, assetId),
        eq(rentals.companyId, companyId),
        inArray(rentals.status, ACTIVE_RENTAL_STATUSES as RentalStatus[]),
      ),
    )
    .limit(1);

  if (existing) {
    throw new AppError(
      409,
      `Asset already has an active rental (id=${existing.id}, status=${existing.status})`,
      "ASSET_RENTAL_CONFLICT",
    );
  }
}

export async function createRental(data: InsertRental, userId?: string) {
  await validateRentalOwnership(
    data.companyId,
    data.clientId,
    data.assetId,
    data.branchId,
  );
  await checkActiveRentalConflict(data.assetId, data.companyId);

  const blacklistResult = await checkClientBlacklist(
    data.clientId,
    data.companyId,
    data.branchId ?? undefined,
  );
  let blacklistWarnings: { action: string; reason: string }[] = [];

  if (blacklistResult.isBlocked) {
    const hardBlocks = blacklistResult.entries.filter((e) =>
      BLOCKING_BLACKLIST_ACTIONS.includes(e.actionType),
    );
    throw new BlacklistBlockedError(
      "Client is blocked and cannot rent",
      hardBlocks.map((e) => ({
        action: e.actionType,
        reason: e.reasonText ?? e.reasonCode,
      })),
    );
  }

  if (blacklistResult.isBlacklisted) {
    blacklistWarnings = blacklistResult.entries.map((e) => ({
      action: e.actionType,
      reason: e.reasonText ?? e.reasonCode,
    }));
  }

  const [rental] = await db.insert(rentals).values(data).returning();

  await writeRentalStatusHistory(
    rental.companyId,
    rental.id,
    null,
    rental.status,
    userId,
    "Rental created",
  );

  return {
    ...rental,
    blacklistWarnings:
      blacklistWarnings.length > 0 ? blacklistWarnings : undefined,
  };
}

export async function getRental(id: string, companyId: string) {
  return getRentalOrThrow(id, companyId);
}

export async function listRentals(companyId: string, status?: string) {
  const conditions = [eq(rentals.companyId, companyId)];
  if (status) conditions.push(eq(rentals.status, status as RentalStatus));
  return db
    .select()
    .from(rentals)
    .where(and(...conditions));
}

export async function approveRental(
  id: string,
  companyId: string,
  userId?: string,
) {
  const rental = await getRentalOrThrow(id, companyId);
  const targetStatus = "awaiting_payment";
  validateTransition(rental.status, targetStatus);

  const [updated] = await db
    .update(rentals)
    .set({ status: targetStatus, updatedAt: new Date() })
    .where(and(eq(rentals.id, id), eq(rentals.companyId, companyId)))
    .returning();

  await writeRentalStatusHistory(
    companyId,
    id,
    rental.status,
    targetStatus,
    userId,
    "Rental approved",
  );
  return { updated, previousStatus: rental.status };
}

export async function startRental(
  id: string,
  companyId: string,
  userId?: string,
) {
  const rental = await getRentalOrThrow(id, companyId);
  validateTransition(rental.status, "active");

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, rental.assetId), eq(assets.companyId, companyId)))
    .limit(1);
  if (!asset) throw new NotFoundError("Rental asset not found");

  if (!ASSET_STATUSES_ALLOWED_FOR_START.includes(asset.status)) {
    throw new AssetUnavailableError(
      `Cannot start rental: asset status '${asset.status}' not allowed. Must be: ${ASSET_STATUSES_ALLOWED_FOR_START.join(", ")}`,
    );
  }

  const blacklistResult = await checkClientBlacklist(
    rental.clientId,
    companyId,
    rental.branchId ?? undefined,
  );
  if (blacklistResult.isBlocked) {
    const hardBlocks = blacklistResult.entries.filter((e) =>
      BLOCKING_BLACKLIST_ACTIONS.includes(e.actionType),
    );
    throw new BlacklistBlockedError(
      "Client was blacklisted after rental creation and cannot start rental",
      hardBlocks.map((e) => ({
        action: e.actionType,
        reason: e.reasonText ?? e.reasonCode,
      })),
    );
  }

  const [updated] = await db
    .update(rentals)
    .set({
      status: "active",
      startAt: rental.startAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(rentals.id, id), eq(rentals.companyId, companyId)))
    .returning();

  await writeRentalStatusHistory(
    companyId,
    id,
    rental.status,
    "active",
    userId,
    "Rental started",
  );
  await setAssetStatus(
    rental.assetId,
    "rented",
    companyId,
    userId,
    `Rental ${id} started`,
  );

  return { updated, previousStatus: rental.status };
}

export async function extendRental(
  id: string,
  companyId: string,
  newEndDate: Date,
  userId?: string,
  reason?: string,
) {
  const rental = await getRentalOrThrow(id, companyId);
  validateTransition(rental.status, "extended");

  const [updated] = await db
    .update(rentals)
    .set({
      status: "extended",
      plannedEndAt: newEndDate,
      updatedAt: new Date(),
    })
    .where(and(eq(rentals.id, id), eq(rentals.companyId, companyId)))
    .returning();

  await writeRentalStatusHistory(
    companyId,
    id,
    rental.status,
    "extended",
    userId,
    reason ?? `Extended to ${newEndDate.toISOString()}`,
  );

  return { updated, previousStatus: rental.status };
}

export interface ReturnRentalPayload {
  returnedToStationId?: string;
  assetReturnStatus?: "available" | "maintenance" | "charging";
  notes?: string;
}

export async function returnRental(
  id: string,
  companyId: string,
  payload: ReturnRentalPayload,
  userId?: string,
) {
  const rental = await getRentalOrThrow(id, companyId);

  const validReturnFrom = ["active", "extended", "overdue", "return_requested"];
  if (!validReturnFrom.includes(rental.status)) {
    throw new InvalidStatusTransitionError(
      rental.status,
      "completed",
      "rental",
    );
  }

  if (payload.returnedToStationId) {
    const [station] = await db
      .select({ id: stations.id })
      .from(stations)
      .where(
        and(
          eq(stations.id, payload.returnedToStationId),
          eq(stations.companyId, companyId),
        ),
      )
      .limit(1);
    if (!station) {
      throw new AppError(
        400,
        "Return station does not belong to this company",
        "INVALID_STATION",
      );
    }
  }

  const updateData: Record<string, unknown> = {
    status: "completed" as RentalStatus,
    actualEndAt: new Date(),
    updatedAt: new Date(),
  };
  if (payload.returnedToStationId)
    updateData.returnedToStationId = payload.returnedToStationId;
  if (payload.notes) updateData.notes = payload.notes;

  const [updated] = await db
    .update(rentals)
    .set(updateData)
    .where(and(eq(rentals.id, id), eq(rentals.companyId, companyId)))
    .returning();

  await writeRentalStatusHistory(
    companyId,
    id,
    rental.status,
    "completed",
    userId,
    "Rental returned",
  );

  const assetStatus = payload.assetReturnStatus ?? "available";
  await setAssetStatus(
    rental.assetId,
    assetStatus,
    companyId,
    userId,
    `Rental ${id} returned`,
  );

  return { updated, previousStatus: rental.status };
}

export async function cancelRental(
  id: string,
  companyId: string,
  userId?: string,
  reason?: string,
) {
  const rental = await getRentalOrThrow(id, companyId);
  validateTransition(rental.status, "canceled");

  const [updated] = await db
    .update(rentals)
    .set({
      status: "canceled" as RentalStatus,
      actualEndAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(rentals.id, id), eq(rentals.companyId, companyId)))
    .returning();

  await writeRentalStatusHistory(
    companyId,
    id,
    rental.status,
    "canceled",
    userId,
    reason ?? "Rental canceled",
  );

  const statusesNeedingRollback = ["active", "extended", "overdue"];
  if (statusesNeedingRollback.includes(rental.status)) {
    await setAssetStatus(
      rental.assetId,
      "available",
      companyId,
      userId,
      `Rental ${id} canceled`,
    );
  }

  return { updated, previousStatus: rental.status };
}

export async function getRentalStatusHistory(
  rentalId: string,
  companyId: string,
) {
  return db
    .select()
    .from(rentalStatusHistory)
    .where(
      and(
        eq(rentalStatusHistory.rentalId, rentalId),
        eq(rentalStatusHistory.companyId, companyId),
      ),
    );
}
