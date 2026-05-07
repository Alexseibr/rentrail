import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
  db,
  assets,
  rentals,
  rentalPlans,
  branches,
  clients,
  telemetrySnapshots,
  locationHistory,
} from "@workspace/db";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import {
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
} from "../lib/errors";
import * as commandService from "../services/command.service";
import * as telemetryService from "../services/telemetry.service";
import { logger } from "../lib/logger";

const router = Router();

function requireClient(req: any) {
  if (
    req.user?.tokenType !== "client" ||
    !req.user?.clientId ||
    !req.user?.companyId
  ) {
    throw new UnauthorizedError("Client authentication required");
  }
  return {
    clientId: req.user.clientId as string,
    companyId: req.user.companyId as string,
  };
}

function handleError(res: any, err: any, context: string) {
  if (err instanceof UnauthorizedError) {
    res
      .status(401)
      .json({ error: { code: "UNAUTHORIZED", message: err.message } });
    return;
  }
  if (err instanceof BadRequestError || err instanceof NotFoundError) {
    const status = err instanceof NotFoundError ? 404 : 400;
    res
      .status(status)
      .json({ error: { code: err.constructor.name, message: err.message } });
    return;
  }
  logger.error({ err, context }, "Unhandled error in client API");
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Internal server error" } });
}

async function requireActiveRentalForAsset(
  clientId: string,
  companyId: string,
  assetId: string,
) {
  const [rental] = await db
    .select({ id: rentals.id })
    .from(rentals)
    .where(
      and(
        eq(rentals.companyId, companyId),
        eq(rentals.clientId, clientId),
        eq(rentals.assetId, assetId),
        inArray(rentals.status, ["active", "overdue"]),
      ),
    )
    .limit(1);
  if (!rental)
    throw new BadRequestError(
      "You don't have an active rental for this vehicle",
    );
  return rental;
}

router.get("/client/vehicles", authenticate, async (req, res) => {
  try {
    const { companyId } = requireClient(req);

    const items = await db
      .select({
        id: assets.id,
        assetType: assets.assetType,
        brand: assets.brand,
        model: assets.model,
        internalCode: assets.internalCode,
        status: assets.status,
        branchId: assets.branchId,
        isPublic: assets.isPublic,
      })
      .from(assets)
      .where(
        and(
          eq(assets.companyId, companyId),
          eq(assets.status, "available"),
          eq(assets.isPublic, true),
        ),
      );

    const assetIds = items.map((a) => a.id);
    let telemetryMap = new Map<
      string,
      { lat: number; lng: number; batteryPercent: number | null }
    >();

    if (assetIds.length > 0) {
      try {
        const snaps = await db
          .select({
            assetId: telemetrySnapshots.assetId,
            lat: telemetrySnapshots.lat,
            lng: telemetrySnapshots.lng,
            batteryPercent: telemetrySnapshots.batteryPercent,
          })
          .from(telemetrySnapshots)
          .where(
            and(
              eq(telemetrySnapshots.companyId, companyId),
              inArray(telemetrySnapshots.assetId, assetIds),
            ),
          )
          .orderBy(
            sql`${telemetrySnapshots.assetId}, ${telemetrySnapshots.recordedAt} DESC`,
          );

        const seen = new Set<string>();
        for (const r of snaps) {
          if (
            r.assetId &&
            !seen.has(r.assetId) &&
            r.lat != null &&
            r.lng != null
          ) {
            seen.add(r.assetId);
            telemetryMap.set(r.assetId, {
              lat: Number(r.lat),
              lng: Number(r.lng),
              batteryPercent: r.batteryPercent,
            });
          }
        }
      } catch (e) {
        logger.error({ err: e }, "Telemetry query failed");
      }
    }

    const branchIds = [...new Set(items.map((a) => a.branchId))];
    let branchMap = new Map<string, string>();
    if (branchIds.length > 0) {
      const branchRows = await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(inArray(branches.id, branchIds));
      for (const b of branchRows) {
        branchMap.set(b.id, b.name);
      }
    }

    const result = items.map((a) => {
      const telem = telemetryMap.get(a.id);
      return {
        ...a,
        branchName: branchMap.get(a.branchId) ?? null,
        lat: telem?.lat ?? null,
        lng: telem?.lng ?? null,
        batteryPercent: telem?.batteryPercent ?? null,
      };
    });

    res.json({ data: result });
  } catch (err: any) {
    handleError(res, err, "GET /client/vehicles");
  }
});

router.get("/client/rentals", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);

    const items = await db
      .select({
        id: rentals.id,
        assetId: rentals.assetId,
        branchId: rentals.branchId,
        status: rentals.status,
        startAt: rentals.startAt,
        plannedEndAt: rentals.plannedEndAt,
        actualEndAt: rentals.actualEndAt,
        depositAmount: rentals.depositAmount,
        createdAt: rentals.createdAt,
      })
      .from(rentals)
      .where(
        and(eq(rentals.companyId, companyId), eq(rentals.clientId, clientId)),
      )
      .orderBy(sql`${rentals.createdAt} DESC`);

    const assetIdSet = new Set<string>();
    for (const r of items) {
      if (r.assetId) assetIdSet.add(r.assetId);
    }
    const assetIds = Array.from(assetIdSet);
    let assetMap = new Map<
      string,
      { internalCode: string; assetType: string; brand: string; model: string }
    >();
    if (assetIds.length > 0) {
      const assetRows = await db
        .select({
          id: assets.id,
          internalCode: assets.internalCode,
          assetType: assets.assetType,
          brand: assets.brand,
          model: assets.model,
        })
        .from(assets)
        .where(inArray(assets.id, assetIds));
      for (const a of assetRows) {
        assetMap.set(a.id, {
          internalCode: a.internalCode ?? "",
          assetType: a.assetType,
          brand: a.brand ?? "",
          model: a.model ?? "",
        });
      }
    }

    const result = items.map((r) => {
      const asset = r.assetId ? assetMap.get(r.assetId) : null;
      return {
        id: r.id,
        assetId: r.assetId,
        branchId: r.branchId,
        status: r.status,
        startAt: r.startAt,
        plannedEndAt: r.plannedEndAt,
        actualEndAt: r.actualEndAt,
        depositAmount: r.depositAmount,
        createdAt: r.createdAt,
        assetCode: asset?.internalCode ?? null,
        assetType: asset?.assetType ?? null,
        assetBrand: asset?.brand ?? null,
        assetModel: asset?.model ?? null,
      };
    });

    res.json({ data: result });
  } catch (err: any) {
    handleError(res, err, "GET /client/rentals");
  }
});

router.post("/client/rentals", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);

    const { assetId, rentalPlanId } = req.body;
    if (!assetId) throw new BadRequestError("assetId is required");

    const [asset] = await db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.id, assetId),
          eq(assets.companyId, companyId),
          eq(assets.isPublic, true),
        ),
      )
      .limit(1);

    if (!asset) throw new NotFoundError("Vehicle not found");
    if (asset.status !== "available")
      throw new BadRequestError("Vehicle is not available for rent");

    const [activeRental] = await db
      .select({ id: rentals.id })
      .from(rentals)
      .where(
        and(
          eq(rentals.companyId, companyId),
          eq(rentals.clientId, clientId),
          inArray(rentals.status, ["active", "overdue"]),
        ),
      )
      .limit(1);

    if (activeRental)
      throw new BadRequestError("You already have an active rental");

    const [clientRecord] = await db
      .select({ status: clients.status })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!clientRecord || clientRecord.status !== "active") {
      throw new BadRequestError("Your account is not active");
    }

    let plan: any = null;
    if (rentalPlanId) {
      const [p] = await db
        .select()
        .from(rentalPlans)
        .where(
          and(
            eq(rentalPlans.id, rentalPlanId),
            eq(rentalPlans.companyId, companyId),
          ),
        )
        .limit(1);
      plan = p;
    }

    const [rental] = await db
      .insert(rentals)
      .values({
        companyId,
        branchId: asset.branchId,
        clientId,
        assetId,
        rentalPlanId: plan?.id,
        status: "active",
        startAt: new Date(),
        tariffSnapshot: plan
          ? { name: plan.name, price: plan.price }
          : { name: "Standard", price: "0" },
        depositAmount: plan?.depositAmount ?? "0",
      })
      .returning();

    await db
      .update(assets)
      .set({ status: "rented", updatedAt: new Date() })
      .where(eq(assets.id, assetId));

    res.status(201).json({ data: rental });
  } catch (err: any) {
    handleError(res, err, "POST /client/rentals");
  }
});

router.post("/client/rentals/:id/return", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const rentalId = req.params.id as string;

    const [rental] = await db
      .select()
      .from(rentals)
      .where(
        and(
          eq(rentals.id, rentalId),
          eq(rentals.companyId, companyId),
          eq(rentals.clientId, clientId),
        ),
      )
      .limit(1);

    if (!rental) throw new NotFoundError("Rental not found");
    if (rental.status !== "active" && rental.status !== "overdue") {
      throw new BadRequestError("Rental cannot be returned in current status");
    }

    const [updated] = await db
      .update(rentals)
      .set({
        status: "completed",
        actualEndAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rentals.id, rentalId))
      .returning();

    if (rental.assetId) {
      await db
        .update(assets)
        .set({ status: "available", updatedAt: new Date() })
        .where(eq(assets.id, rental.assetId));
    }

    res.json({ data: updated });
  } catch (err: any) {
    handleError(res, err, "POST /client/rentals/:id/return");
  }
});

router.get("/client/profile", authenticate, async (req, res) => {
  try {
    const { clientId } = requireClient(req);

    const [client] = await db
      .select({
        id: clients.id,
        companyId: clients.companyId,
        fullName: clients.fullName,
        phone: clients.phone,
        email: clients.email,
        status: clients.status,
        rating: clients.rating,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) throw new NotFoundError("Client not found");

    res.json({ data: { ...client, tokenType: "client" } });
  } catch (err: any) {
    handleError(res, err, "GET /client/profile");
  }
});

router.get("/client/vehicles/lookup", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const code = ((req.query.code as string) ?? "").trim();
    if (!code) throw new BadRequestError("code query parameter is required");

    const [asset] = await db
      .select({
        id: assets.id,
        assetType: assets.assetType,
        brand: assets.brand,
        model: assets.model,
        internalCode: assets.internalCode,
        status: assets.status,
      })
      .from(assets)
      .where(
        and(
          eq(assets.companyId, companyId),
          eq(assets.internalCode, code),
          eq(assets.isPublic, true),
        ),
      )
      .limit(1);

    if (!asset) throw new NotFoundError("Vehicle not found");

    const [activeRental] = await db
      .select({ id: rentals.id, status: rentals.status })
      .from(rentals)
      .where(
        and(
          eq(rentals.companyId, companyId),
          eq(rentals.clientId, clientId),
          eq(rentals.assetId, asset.id),
          inArray(rentals.status, ["active", "overdue"]),
        ),
      )
      .limit(1);

    res.json({ data: { ...asset, hasActiveRental: !!activeRental } });
  } catch (err: any) {
    handleError(res, err, "GET /client/vehicles/lookup");
  }
});

router.get("/client/vehicles/:id", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const assetId = req.params.id as string;

    await requireActiveRentalForAsset(clientId, companyId, assetId);

    const [asset] = await db
      .select({
        id: assets.id,
        assetType: assets.assetType,
        brand: assets.brand,
        model: assets.model,
        internalCode: assets.internalCode,
        status: assets.status,
        branchId: assets.branchId,
      })
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId)))
      .limit(1);

    if (!asset) throw new NotFoundError("Vehicle not found");

    const telemetry = await telemetryService.getLatestSnapshotForAsset(
      assetId,
      companyId,
    );

    res.json({
      data: {
        ...asset,
        telemetry: telemetry
          ? {
              lat: telemetry.lat ? Number(telemetry.lat) : null,
              lng: telemetry.lng ? Number(telemetry.lng) : null,
              speed: telemetry.speed ? Number(telemetry.speed) : null,
              batteryPercent: telemetry.batteryPercent,
              batteryVoltage: telemetry.batteryVoltage
                ? Number(telemetry.batteryVoltage)
                : null,
              lockState: telemetry.lockState,
              alarmState: telemetry.alarmState,
              onlineState: telemetry.onlineState,
              odometer: telemetry.odometer ? Number(telemetry.odometer) : null,
              recordedAt: telemetry.recordedAt,
            }
          : null,
      },
    });
  } catch (err: any) {
    handleError(res, err, "GET /client/vehicles/:id");
  }
});

router.get("/client/vehicles/:id/locations", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const assetId = req.params.id as string;

    await requireActiveRentalForAsset(clientId, companyId, assetId);

    const locations = await telemetryService.getLocationsForAsset(
      assetId,
      companyId,
      {
        limit: Number(req.query.limit) || 100,
      },
    );

    res.json({
      data: locations.map((l) => ({
        lat: Number(l.lat),
        lng: Number(l.lng),
        speed: l.speed ? Number(l.speed) : null,
        recordedAt: l.recordedAt,
      })),
    });
  } catch (err: any) {
    handleError(res, err, "GET /client/vehicles/:id/locations");
  }
});

router.post("/client/vehicles/:id/lock", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const assetId = req.params.id as string;
    await requireActiveRentalForAsset(clientId, companyId, assetId);

    const cmd = await commandService.enqueueAssetCommand(
      companyId,
      assetId,
      "lock",
      clientId,
    );
    res.json({ data: { commandId: cmd.id, status: cmd.status } });
  } catch (err: any) {
    handleError(res, err, "POST /client/vehicles/:id/lock");
  }
});

router.post("/client/vehicles/:id/unlock", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const assetId = req.params.id as string;
    await requireActiveRentalForAsset(clientId, companyId, assetId);

    const cmd = await commandService.enqueueAssetCommand(
      companyId,
      assetId,
      "unlock",
      clientId,
    );
    res.json({ data: { commandId: cmd.id, status: cmd.status } });
  } catch (err: any) {
    handleError(res, err, "POST /client/vehicles/:id/unlock");
  }
});

router.post("/client/vehicles/:id/arm", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const assetId = req.params.id as string;
    await requireActiveRentalForAsset(clientId, companyId, assetId);

    const cmd = await commandService.enqueueAssetCommand(
      companyId,
      assetId,
      "arm_alarm",
      clientId,
    );
    res.json({ data: { commandId: cmd.id, status: cmd.status } });
  } catch (err: any) {
    handleError(res, err, "POST /client/vehicles/:id/arm");
  }
});

router.post("/client/vehicles/:id/disarm", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const assetId = req.params.id as string;
    await requireActiveRentalForAsset(clientId, companyId, assetId);

    const cmd = await commandService.enqueueAssetCommand(
      companyId,
      assetId,
      "disarm_alarm",
      clientId,
    );
    res.json({ data: { commandId: cmd.id, status: cmd.status } });
  } catch (err: any) {
    handleError(res, err, "POST /client/vehicles/:id/disarm");
  }
});

router.get("/client/rentals/:id", authenticate, async (req, res) => {
  try {
    const { clientId, companyId } = requireClient(req);
    const rentalId = req.params.id as string;

    const [rental] = await db
      .select()
      .from(rentals)
      .where(
        and(
          eq(rentals.id, rentalId),
          eq(rentals.companyId, companyId),
          eq(rentals.clientId, clientId),
        ),
      )
      .limit(1);

    if (!rental) throw new NotFoundError("Rental not found");

    const [asset] = rental.assetId
      ? await db
          .select({
            id: assets.id,
            assetType: assets.assetType,
            brand: assets.brand,
            model: assets.model,
            internalCode: assets.internalCode,
          })
          .from(assets)
          .where(eq(assets.id, rental.assetId))
          .limit(1)
      : [null];

    let telemetry = null;
    if (
      rental.assetId &&
      (rental.status === "active" || rental.status === "overdue")
    ) {
      telemetry = await telemetryService.getLatestSnapshotForAsset(
        rental.assetId,
        companyId,
      );
    }

    const durationMs = rental.startAt
      ? (rental.actualEndAt ?? new Date()).getTime() - rental.startAt.getTime()
      : 0;
    const durationMinutes = Math.round(durationMs / 60000);

    res.json({
      data: {
        id: rental.id,
        status: rental.status,
        startAt: rental.startAt,
        plannedEndAt: rental.plannedEndAt,
        actualEndAt: rental.actualEndAt,
        depositAmount: rental.depositAmount,
        notes: rental.notes,
        createdAt: rental.createdAt,
        durationMinutes,
        asset: asset
          ? {
              id: asset.id,
              assetType: asset.assetType,
              brand: asset.brand,
              model: asset.model,
              internalCode: asset.internalCode,
            }
          : null,
        telemetry: telemetry
          ? {
              lat: telemetry.lat ? Number(telemetry.lat) : null,
              lng: telemetry.lng ? Number(telemetry.lng) : null,
              speed: telemetry.speed ? Number(telemetry.speed) : null,
              batteryPercent: telemetry.batteryPercent,
              lockState: telemetry.lockState,
              odometer: telemetry.odometer ? Number(telemetry.odometer) : null,
              recordedAt: telemetry.recordedAt,
            }
          : null,
      },
    });
  } catch (err: any) {
    handleError(res, err, "GET /client/rentals/:id");
  }
});

export default router;
