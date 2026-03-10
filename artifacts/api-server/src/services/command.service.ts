import { db, deviceCommands, devices, assetDevices } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";
import { validateAssetOwnership } from "../lib/validate-ownership";

type CommandStatus = typeof deviceCommands.$inferSelect.status;
type CommandType = typeof deviceCommands.$inferSelect.commandType;

export async function enqueueCommand(
  companyId: string,
  deviceId: string,
  data: {
    commandType: string;
    payload?: unknown;
    assetId?: string;
    requestedByUserId?: string;
    expiresInMinutes?: number;
  },
) {
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.companyId, companyId)))
    .limit(1);
  if (!device) throw new NotFoundError("Device not found");

  if (data.assetId) await validateAssetOwnership(companyId, data.assetId);

  if (device.capabilities) {
    const caps = device.capabilities as string[];
    if (
      Array.isArray(caps) &&
      caps.length > 0 &&
      !caps.includes(data.commandType)
    ) {
      throw new AppError(
        422,
        `Device does not support command '${data.commandType}'`,
        "UNSUPPORTED_COMMAND",
      );
    }
  }

  const expiresAt = data.expiresInMinutes
    ? new Date(Date.now() + data.expiresInMinutes * 60000)
    : null;

  const [cmd] = await db
    .insert(deviceCommands)
    .values({
      companyId,
      deviceId,
      assetId: data.assetId ?? null,
      commandType: data.commandType as CommandType,
      payload: data.payload ?? null,
      requestedByUserId: data.requestedByUserId ?? null,
      expiresAt,
    })
    .returning();
  return cmd;
}

export async function getCommand(id: string, companyId: string) {
  const [cmd] = await db
    .select()
    .from(deviceCommands)
    .where(
      and(eq(deviceCommands.id, id), eq(deviceCommands.companyId, companyId)),
    )
    .limit(1);
  if (!cmd) throw new NotFoundError("Command not found");
  return cmd;
}

export async function listDeviceCommands(deviceId: string, companyId: string) {
  return db
    .select()
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.deviceId, deviceId),
        eq(deviceCommands.companyId, companyId),
      ),
    )
    .orderBy(desc(deviceCommands.queuedAt));
}

export async function listAssetCommands(assetId: string, companyId: string) {
  return db
    .select()
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.assetId, assetId),
        eq(deviceCommands.companyId, companyId),
      ),
    )
    .orderBy(desc(deviceCommands.queuedAt))
    .limit(20);
}

const COMMAND_STATUS_TRANSITIONS: Record<string, string[]> = {
  queued: ["sent", "failed", "expired", "canceled"],
  sent: ["acknowledged", "failed", "expired"],
  acknowledged: [],
  failed: [],
  expired: [],
  canceled: [],
};

export async function updateCommandStatus(
  id: string,
  companyId: string,
  newStatus: string,
  extra?: { responsePayload?: unknown; errorMessage?: string },
) {
  const cmd = await getCommand(id, companyId);
  const allowed = COMMAND_STATUS_TRANSITIONS[cmd.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      422,
      `Cannot transition command from '${cmd.status}' to '${newStatus}'`,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: new Date(),
  };
  if (newStatus === "sent") updates.sentAt = new Date();
  if (newStatus === "acknowledged") updates.acknowledgedAt = new Date();
  if (newStatus === "failed") {
    updates.failedAt = new Date();
    updates.errorMessage = extra?.errorMessage ?? null;
  }
  if (extra?.responsePayload) updates.responsePayload = extra.responsePayload;

  const [updated] = await db
    .update(deviceCommands)
    .set(
      updates as Partial<typeof deviceCommands.$inferInsert> & {
        status: CommandStatus;
        updatedAt: Date;
      },
    )
    .where(
      and(eq(deviceCommands.id, id), eq(deviceCommands.companyId, companyId)),
    )
    .returning();
  if (!updated) throw new NotFoundError("Command not found");
  return updated;
}

export async function enqueueAssetCommand(
  companyId: string,
  assetId: string,
  commandType: string,
  userId?: string,
) {
  const commandToBinding: Record<string, string> = {
    lock: "lock",
    unlock: "lock",
    arm_alarm: "tracker",
    disarm_alarm: "tracker",
    locate: "tracker",
    ping: "tracker",
    disable: "controller",
    set_speed_limit: "tracker",
  };
  const neededType = commandToBinding[commandType] ?? "tracker";

  const bindings = await db
    .select({
      deviceId: assetDevices.deviceId,
      bindingType: assetDevices.bindingType,
      isPrimary: assetDevices.isPrimary,
    })
    .from(assetDevices)
    .where(
      and(
        eq(assetDevices.assetId, assetId),
        eq(assetDevices.companyId, companyId),
        eq(assetDevices.status, "active"),
      ),
    );

  let targetDeviceId: string | null = null;
  const primaryMatch = bindings.find(
    (b) => b.bindingType === neededType && b.isPrimary,
  );
  if (primaryMatch) {
    targetDeviceId = primaryMatch.deviceId;
  } else {
    const anyMatch = bindings.find((b) => b.bindingType === neededType);
    if (anyMatch) targetDeviceId = anyMatch.deviceId;
  }

  if (!targetDeviceId) {
    throw new AppError(
      422,
      `No suitable ${neededType} device bound to this asset`,
      "NO_DEVICE_BOUND",
    );
  }

  return enqueueCommand(companyId, targetDeviceId, {
    commandType,
    assetId,
    requestedByUserId: userId,
    expiresInMinutes: 10,
  });
}
