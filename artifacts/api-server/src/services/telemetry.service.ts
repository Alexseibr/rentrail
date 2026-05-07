import {
  db,
  telemetrySnapshots,
  telemetryEvents,
  locationHistory,
  assetDevices,
  devices,
  deviceCommands,
} from "@workspace/db";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import { createHash } from "crypto";
import * as deviceService from "./device.service";
import {
  getActiveGeofencesForCompany,
  evaluatePointAgainstGeofences,
} from "./geofence.service";
import { enqueueAssetCommand } from "./command.service";
import {
  onGeofenceEnter,
  onGeofenceExit,
  onSpeedLimitExceeded,
} from "./notification.service";
import { logger } from "../lib/logger";

type TelemetryEventType = typeof telemetryEvents.$inferSelect.eventType;
type TelemetryEventSeverity = typeof telemetryEvents.$inferSelect.severity;

function payloadSignature(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? ""))
    .digest("hex")
    .slice(0, 32);
}

interface IngestInput {
  provider: string;
  deviceExternalId?: string;
  deviceId?: string;
  recordedAt: string;
  lat?: number;
  lng?: number;
  speed?: number;
  heading?: number;
  batteryPercent?: number;
  batteryVoltage?: number;
  lockState?: string;
  alarmState?: string;
  onlineState?: string;
  odometer?: number;
  rawPayload?: unknown;
  events?: Array<{ eventType: string; severity?: string; payload?: unknown }>;
}

interface IngestContext {
  companyId: string;
  provider: string;
}

async function hasRecentGeofenceEvent(
  deviceId: string,
  companyId: string,
  geofenceId: string,
  eventType: "geofence_enter" | "geofence_exit",
  withinSeconds = 300,
): Promise<boolean> {
  const since = new Date(Date.now() - withinSeconds * 1000);
  const rows = await db
    .select({ id: telemetryEvents.id })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.deviceId, deviceId),
        eq(telemetryEvents.companyId, companyId),
        eq(telemetryEvents.eventType, eventType as TelemetryEventType),
        gte(telemetryEvents.recordedAt, since),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

async function hasPendingCommand(
  deviceId: string,
  commandType: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: deviceCommands.id })
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.deviceId, deviceId),
        eq(
          deviceCommands.commandType,
          commandType as typeof deviceCommands.$inferSelect.commandType,
        ),
        inArray(deviceCommands.status, ["queued", "sent"]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function evaluateGeofences(
  deviceId: string,
  assetId: string | null,
  companyId: string,
  lat: number,
  lng: number,
  speed: number | undefined,
  recordedAt: Date,
) {
  let geoList;
  try {
    geoList = await getActiveGeofencesForCompany(companyId);
  } catch {
    return;
  }
  if (geoList.length === 0) return;

  const results = evaluatePointAgainstGeofences(lat, lng, geoList);

  for (const result of results) {
    const geo = geoList.find((g) => g.id === result.geofenceId);
    if (!geo) continue;

    if (result.inside) {
      const alreadyInside = await hasRecentGeofenceEvent(
        deviceId,
        companyId,
        result.geofenceId,
        "geofence_enter",
      );
      if (!alreadyInside) {
        await db.insert(telemetryEvents).values({
          companyId,
          assetId,
          deviceId,
          eventType: "geofence_enter" as TelemetryEventType,
          severity:
            geo.type === "no_ride_zone"
              ? ("warning" as TelemetryEventSeverity)
              : ("info" as TelemetryEventSeverity),
          payload: {
            geofenceId: geo.id,
            geofenceName: geo.name,
            geofenceType: geo.type,
          },
          recordedAt,
        });

        onGeofenceEnter(
          companyId,
          [],
          geo.id,
          geo.name,
          geo.type,
          assetId ?? undefined,
        ).catch(() => {});

        if (geo.type === "no_ride_zone" && assetId) {
          const alreadyLocked = await hasPendingCommand(deviceId, "lock");
          if (!alreadyLocked) {
            enqueueAssetCommand(companyId, assetId, "lock").catch((err) => {
              logger.error(
                { err, assetId },
                "Failed to enqueue lock command for no_ride_zone",
              );
            });
          }
        }

        const rules = geo.rules as Record<string, unknown> | null;
        if (rules?.maxSpeedKmh && assetId) {
          const limitKmh = Number(rules.maxSpeedKmh);
          if (speed !== undefined && speed > limitKmh) {
            onSpeedLimitExceeded(companyId, [], assetId, speed, limitKmh).catch(
              () => {},
            );
          }
          const alreadySpeedLimited = await hasPendingCommand(
            deviceId,
            "set_speed_limit",
          );
          if (!alreadySpeedLimited) {
            enqueueAssetCommand(companyId, assetId, "set_speed_limit").catch(
              (err) => {
                logger.error(
                  { err, assetId },
                  "Failed to enqueue set_speed_limit command",
                );
              },
            );
          }
        }
      } else {
        const rules = geo.rules as Record<string, unknown> | null;
        if (rules?.maxSpeedKmh && assetId && speed !== undefined) {
          const limitKmh = Number(rules.maxSpeedKmh);
          if (speed > limitKmh) {
            onSpeedLimitExceeded(companyId, [], assetId, speed, limitKmh).catch(
              () => {},
            );
          }
        }
      }
    } else {
      const wasInside = await hasRecentGeofenceEvent(
        deviceId,
        companyId,
        result.geofenceId,
        "geofence_enter",
      );
      if (wasInside) {
        const alreadyExited = await hasRecentGeofenceEvent(
          deviceId,
          companyId,
          result.geofenceId,
          "geofence_exit",
          60,
        );
        if (!alreadyExited) {
          await db.insert(telemetryEvents).values({
            companyId,
            assetId,
            deviceId,
            eventType: "geofence_exit" as TelemetryEventType,
            severity:
              geo.type === "operating_zone"
                ? ("warning" as TelemetryEventSeverity)
                : ("info" as TelemetryEventSeverity),
            payload: {
              geofenceId: geo.id,
              geofenceName: geo.name,
              geofenceType: geo.type,
            },
            recordedAt,
          });

          onGeofenceExit(
            companyId,
            [],
            geo.id,
            geo.name,
            geo.type,
            assetId ?? undefined,
          ).catch(() => {});
        }
      }
    }
  }
}

export async function ingestTelemetry(input: IngestInput, ctx: IngestContext) {
  let device: typeof devices.$inferSelect | null = null;

  if (input.deviceId) {
    device = await deviceService
      .getDevice(input.deviceId, ctx.companyId)
      .catch(() => null);
  }
  if (!device && input.deviceExternalId) {
    device = await deviceService.getDeviceByExternalId(
      ctx.companyId,
      ctx.provider,
      input.deviceExternalId,
    );
  }
  if (!device) {
    return { status: "skipped", reason: "device_not_found" };
  }

  if (device.companyId !== ctx.companyId) {
    return { status: "skipped", reason: "company_mismatch" };
  }

  if (device.provider !== ctx.provider) {
    return { status: "skipped", reason: "provider_mismatch" };
  }

  const recordedAt = new Date(input.recordedAt);
  const sig = payloadSignature({ ...input, deviceId: device.id });
  void sig;

  const activeBindings = await db
    .select({ assetId: assetDevices.assetId })
    .from(assetDevices)
    .where(
      and(
        eq(assetDevices.deviceId, device.id),
        eq(assetDevices.companyId, ctx.companyId),
        eq(assetDevices.status, "active"),
      ),
    )
    .limit(1);
  const assetId = activeBindings.length > 0 ? activeBindings[0].assetId : null;

  const [snapshot] = await db
    .insert(telemetrySnapshots)
    .values({
      companyId: ctx.companyId,
      assetId,
      deviceId: device.id,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      speed: input.speed ?? null,
      heading: input.heading ?? null,
      batteryPercent: input.batteryPercent ?? null,
      batteryVoltage: input.batteryVoltage ?? null,
      lockState: input.lockState ?? null,
      alarmState: input.alarmState ?? null,
      onlineState: input.onlineState ?? null,
      odometer: input.odometer ?? null,
      payload: input.rawPayload ?? null,
      recordedAt,
    })
    .returning();

  if (input.lat != null && input.lng != null) {
    await db.insert(locationHistory).values({
      companyId: ctx.companyId,
      assetId,
      deviceId: device.id,
      lat: input.lat,
      lng: input.lng,
      speed: input.speed ?? null,
      heading: input.heading ?? null,
      recordedAt,
    });

    evaluateGeofences(
      device.id,
      assetId,
      ctx.companyId,
      input.lat,
      input.lng,
      input.speed,
      recordedAt,
    ).catch((err) => {
      logger.error({ err, deviceId: device!.id }, "Geofence evaluation error");
    });
  }

  if (input.events && input.events.length > 0) {
    for (const evt of input.events) {
      await db.insert(telemetryEvents).values({
        companyId: ctx.companyId,
        assetId,
        deviceId: device.id,
        eventType: evt.eventType as TelemetryEventType,
        severity: (evt.severity ?? "info") as TelemetryEventSeverity,
        payload: evt.payload ?? null,
        recordedAt,
      });
    }
  }

  if (input.onlineState === "online" || input.lat != null) {
    const derivedEvents: Array<{ eventType: string; severity: string }> = [];
    if (input.onlineState === "online")
      derivedEvents.push({ eventType: "online", severity: "info" });
    if (input.batteryPercent != null && input.batteryPercent < 15)
      derivedEvents.push({ eventType: "low_battery", severity: "warning" });
    for (const de of derivedEvents) {
      await db.insert(telemetryEvents).values({
        companyId: ctx.companyId,
        assetId,
        deviceId: device.id,
        eventType: de.eventType as TelemetryEventType,
        severity: de.severity as TelemetryEventSeverity,
        recordedAt,
      });
    }
  }

  await deviceService.updateLastSeen(device.id);

  return {
    status: "ok",
    snapshotId: snapshot.id,
    deviceId: device.id,
    assetId,
  };
}

export async function getLatestSnapshotForAsset(
  assetId: string,
  companyId: string,
) {
  const [snap] = await db
    .select()
    .from(telemetrySnapshots)
    .where(
      and(
        eq(telemetrySnapshots.assetId, assetId),
        eq(telemetrySnapshots.companyId, companyId),
      ),
    )
    .orderBy(desc(telemetrySnapshots.recordedAt))
    .limit(1);
  return snap ?? null;
}

export async function getLatestSnapshotForDevice(
  deviceId: string,
  companyId: string,
) {
  const [snap] = await db
    .select()
    .from(telemetrySnapshots)
    .where(
      and(
        eq(telemetrySnapshots.deviceId, deviceId),
        eq(telemetrySnapshots.companyId, companyId),
      ),
    )
    .orderBy(desc(telemetrySnapshots.recordedAt))
    .limit(1);
  return snap ?? null;
}

export async function getEventsForAsset(
  assetId: string,
  companyId: string,
  filters?: {
    from?: string;
    to?: string;
    eventType?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  },
) {
  const conditions = [
    eq(telemetryEvents.assetId, assetId),
    eq(telemetryEvents.companyId, companyId),
  ];
  if (filters?.from)
    conditions.push(gte(telemetryEvents.recordedAt, new Date(filters.from)));
  if (filters?.to)
    conditions.push(lte(telemetryEvents.recordedAt, new Date(filters.to)));
  if (filters?.eventType)
    conditions.push(
      eq(telemetryEvents.eventType, filters.eventType as TelemetryEventType),
    );
  if (filters?.severity)
    conditions.push(
      eq(telemetryEvents.severity, filters.severity as TelemetryEventSeverity),
    );
  return db
    .select()
    .from(telemetryEvents)
    .where(and(...conditions))
    .orderBy(desc(telemetryEvents.recordedAt))
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0);
}

export async function getEventsForDevice(
  deviceId: string,
  companyId: string,
  filters?: {
    from?: string;
    to?: string;
    eventType?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  },
) {
  const conditions = [
    eq(telemetryEvents.deviceId, deviceId),
    eq(telemetryEvents.companyId, companyId),
  ];
  if (filters?.from)
    conditions.push(gte(telemetryEvents.recordedAt, new Date(filters.from)));
  if (filters?.to)
    conditions.push(lte(telemetryEvents.recordedAt, new Date(filters.to)));
  if (filters?.eventType)
    conditions.push(
      eq(telemetryEvents.eventType, filters.eventType as TelemetryEventType),
    );
  if (filters?.severity)
    conditions.push(
      eq(telemetryEvents.severity, filters.severity as TelemetryEventSeverity),
    );
  return db
    .select()
    .from(telemetryEvents)
    .where(and(...conditions))
    .orderBy(desc(telemetryEvents.recordedAt))
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0);
}

export async function getLocationsForAsset(
  assetId: string,
  companyId: string,
  filters?: { from?: string; to?: string; limit?: number; offset?: number },
) {
  const conditions = [
    eq(locationHistory.assetId, assetId),
    eq(locationHistory.companyId, companyId),
  ];
  if (filters?.from)
    conditions.push(gte(locationHistory.recordedAt, new Date(filters.from)));
  if (filters?.to)
    conditions.push(lte(locationHistory.recordedAt, new Date(filters.to)));
  return db
    .select()
    .from(locationHistory)
    .where(and(...conditions))
    .orderBy(desc(locationHistory.recordedAt))
    .limit(filters?.limit ?? 200)
    .offset(filters?.offset ?? 0);
}
