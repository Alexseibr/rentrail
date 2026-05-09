/**
 * Teltonika TCP server — receives CODEC 8 data from FMB/FMC GPS trackers.
 * Each device authenticates by IMEI, then sends AVL packets.
 * Pending commands are delivered back via CODEC 12.
 */
import net from "net";
import { db, devices, deviceCommands } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  parseCodec8Packet,
  getTotalPacketLength,
  buildCodec12Command,
  buildTeltonikaCommand,
} from "./codec8";
import { ingestTelemetry } from "../telemetry.service";
import { updateCommandStatus } from "../command.service";
import { logger } from "../../lib/logger";

const TELTONIKA_PROVIDER = "teltonika";

interface SessionState {
  imei: string | null;
  deviceId: string | null;
  companyId: string | null;
  buffer: Buffer;
  phase: "await_imei" | "connected";
}

async function findDeviceByImei(
  imei: string,
): Promise<{ id: string; companyId: string } | null> {
  const [device] = await db
    .select({ id: devices.id, companyId: devices.companyId })
    .from(devices)
    .where(
      and(eq(devices.imei, imei), eq(devices.provider, TELTONIKA_PROVIDER)),
    )
    .limit(1);
  return device ?? null;
}

async function getPendingCommands(deviceId: string) {
  return db
    .select()
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.deviceId, deviceId),
        inArray(deviceCommands.status, ["queued"]),
      ),
    )
    .limit(5);
}

async function handleCodec8(
  buf: Buffer,
  state: SessionState,
  socket: net.Socket,
) {
  if (!state.deviceId || !state.companyId) return;

  const packet = parseCodec8Packet(buf);
  if (!packet || !packet.crcValid) {
    logger.warn(
      { imei: state.imei },
      "Teltonika: invalid CODEC 8 packet or bad CRC",
    );
    return;
  }

  logger.info(
    { imei: state.imei, records: packet.records.length },
    "Teltonika: CODEC 8 packet received",
  );

  for (const record of packet.records) {
    if (record.lat === 0 && record.lng === 0) continue;
    try {
      await ingestTelemetry(
        {
          provider: TELTONIKA_PROVIDER,
          deviceId: state.deviceId,
          recordedAt: record.timestamp.toISOString(),
          lat: record.lat,
          lng: record.lng,
          speed: record.speed,
          heading: record.angle,
          rawPayload: {
            priority: record.priority,
            satellites: record.satellites,
            ioElements: Object.fromEntries(
              Object.entries(record.ioElements).map(([k, v]) => [k, String(v)]),
            ),
          },
        },
        { companyId: state.companyId, provider: TELTONIKA_PROVIDER },
      );
    } catch (err) {
      logger.error(
        { err, imei: state.imei },
        "Teltonika: failed to ingest telemetry",
      );
    }
  }

  const confirmBuf = Buffer.allocUnsafe(4);
  confirmBuf.writeUInt32BE(packet.records.length, 0);
  socket.write(confirmBuf);

  const pending = await getPendingCommands(state.deviceId);
  for (const cmd of pending) {
    const teltonikaCmd = buildTeltonikaCommand(
      cmd.commandType,
      cmd.payload ? (cmd.payload as Record<string, unknown>) : undefined,
    );
    if (!teltonikaCmd) {
      await updateCommandStatus(cmd.id, state.companyId, "failed", {
        errorMessage: "No Teltonika mapping for command type",
      });
      continue;
    }

    try {
      const cmdPacket = buildCodec12Command(teltonikaCmd);
      socket.write(cmdPacket);
      await updateCommandStatus(cmd.id, state.companyId, "sent");
      logger.info(
        { imei: state.imei, commandType: cmd.commandType, teltonikaCmd },
        "Teltonika: command sent",
      );
    } catch (err) {
      logger.error(
        { err, imei: state.imei, commandId: cmd.id },
        "Teltonika: failed to send command",
      );
    }
  }
}

function handleData(chunk: Buffer, state: SessionState, socket: net.Socket) {
  state.buffer = Buffer.concat([state.buffer, chunk]);

  if (state.phase === "await_imei") {
    if (state.buffer.length < 2) return;

    const imeiLen = state.buffer.readUInt16BE(0);
    if (state.buffer.length < 2 + imeiLen) return;

    const imei = state.buffer.slice(2, 2 + imeiLen).toString("ascii");
    state.buffer = state.buffer.slice(2 + imeiLen);
    state.imei = imei;

    findDeviceByImei(imei)
      .then((device) => {
        if (!device) {
          logger.warn({ imei }, "Teltonika: IMEI not found in DB — rejecting");
          socket.write(Buffer.from([0x00]));
          socket.destroy();
          return;
        }
        state.deviceId = device.id;
        state.companyId = device.companyId;
        state.phase = "connected";
        socket.write(Buffer.from([0x01]));
        logger.info(
          { imei, deviceId: device.id },
          "Teltonika: device authenticated",
        );
      })
      .catch((err: unknown) => {
        logger.error({ err, imei }, "Teltonika: DB error during IMEI lookup");
        socket.write(Buffer.from([0x00]));
        socket.destroy();
      });
    return;
  }

  if (state.phase === "connected") {
    while (state.buffer.length >= 10) {
      const totalLen = getTotalPacketLength(state.buffer);
      if (totalLen === null || state.buffer.length < totalLen) break;

      const packetBuf = state.buffer.slice(0, totalLen);
      state.buffer = state.buffer.slice(totalLen);

      handleCodec8(packetBuf, state, socket).catch((err: unknown) => {
        logger.error(
          { err, imei: state.imei },
          "Teltonika: error processing CODEC 8 packet",
        );
      });
    }
  }
}

export function startTeltonikaServer(port: number): net.Server {
  const server = net.createServer((socket) => {
    const state: SessionState = {
      imei: null,
      deviceId: null,
      companyId: null,
      buffer: Buffer.alloc(0),
      phase: "await_imei",
    };

    socket.setTimeout(120_000);

    socket.on("data", (chunk: Buffer) => {
      handleData(chunk, state, socket);
    });

    socket.on("timeout", () => {
      logger.info({ imei: state.imei }, "Teltonika: socket timeout — closing");
      socket.destroy();
    });

    socket.on("error", (err) => {
      logger.error({ err, imei: state.imei }, "Teltonika: socket error");
    });

    socket.on("close", () => {
      logger.info({ imei: state.imei }, "Teltonika: connection closed");
    });
  });

  server.listen(port, () => {
    logger.info({ port }, "Teltonika TCP server listening");
  });

  server.on("error", (err) => {
    logger.error({ err }, "Teltonika TCP server error");
  });

  return server;
}
