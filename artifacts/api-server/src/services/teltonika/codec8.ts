/**
 * Teltonika CODEC 8 binary protocol parser.
 * Used by FMB/FMC series GPS trackers.
 *
 * Packet structure:
 * [4 bytes preamble 0x00000000]
 * [4 bytes data length]
 * [1 byte codec ID = 0x08]
 * [1 byte number of data (N)]
 * [N x AVL records]
 * [1 byte number of data (N, repeated)]
 * [4 bytes CRC-16/IBM of everything from codec ID to last number-of-data byte]
 */

export interface AvlRecord {
  timestamp: Date;
  priority: number;
  lng: number;
  lat: number;
  altitude: number;
  angle: number;
  satellites: number;
  speed: number;
  eventIoId: number;
  ioElements: Record<number, number | bigint>;
}

export interface Codec8Packet {
  codecId: number;
  records: AvlRecord[];
  crcValid: boolean;
}

export interface Codec12Packet {
  type: "command" | "response";
  content: string;
}

function crc16ibm(buf: Buffer, start: number, end: number): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    let b = buf[i]!;
    for (let j = 0; j < 8; j++) {
      if ((crc ^ (b << 8)) & 0x8000) {
        crc = (crc << 1) ^ 0x8005;
      } else {
        crc = crc << 1;
      }
      b <<= 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

function parseIoElements(buf: Buffer, offset: number): { ioElements: Record<number, number | bigint>; eventIoId: number; bytesRead: number } {
  let pos = offset;
  const ioElements: Record<number, number | bigint> = {};

  const eventIoId = buf.readUInt8(pos++);
  const totalCount = buf.readUInt8(pos++);
  void totalCount;

  const count1b = buf.readUInt8(pos++);
  for (let i = 0; i < count1b; i++) {
    const id = buf.readUInt8(pos++);
    const val = buf.readUInt8(pos++);
    ioElements[id] = val;
  }

  const count2b = buf.readUInt8(pos++);
  for (let i = 0; i < count2b; i++) {
    const id = buf.readUInt8(pos++);
    const val = buf.readUInt16BE(pos);
    pos += 2;
    ioElements[id] = val;
  }

  const count4b = buf.readUInt8(pos++);
  for (let i = 0; i < count4b; i++) {
    const id = buf.readUInt8(pos++);
    const val = buf.readUInt32BE(pos);
    pos += 4;
    ioElements[id] = val;
  }

  const count8b = buf.readUInt8(pos++);
  for (let i = 0; i < count8b; i++) {
    const id = buf.readUInt8(pos++);
    const hi = buf.readUInt32BE(pos);
    const lo = buf.readUInt32BE(pos + 4);
    pos += 8;
    ioElements[id] = (BigInt(hi) << 32n) | BigInt(lo);
  }

  return { ioElements, eventIoId, bytesRead: pos - offset };
}

function parseAvlRecord(buf: Buffer, offset: number): { record: AvlRecord; bytesRead: number } {
  let pos = offset;

  const tsHi = buf.readUInt32BE(pos);
  const tsLo = buf.readUInt32BE(pos + 4);
  pos += 8;
  const timestampMs = (BigInt(tsHi) << 32n) | BigInt(tsLo);
  const timestamp = new Date(Number(timestampMs));

  const priority = buf.readUInt8(pos++);

  const lngRaw = buf.readInt32BE(pos);
  pos += 4;
  const latRaw = buf.readInt32BE(pos);
  pos += 4;
  const altitude = buf.readInt16BE(pos);
  pos += 2;
  const angle = buf.readUInt16BE(pos);
  pos += 2;
  const satellites = buf.readUInt8(pos++);
  const speed = buf.readUInt16BE(pos);
  pos += 2;

  const lng = lngRaw / 1e7;
  const lat = latRaw / 1e7;

  const { ioElements, eventIoId, bytesRead } = parseIoElements(buf, pos);
  pos += bytesRead;

  return {
    record: { timestamp, priority, lng, lat, altitude, angle, satellites, speed, eventIoId, ioElements },
    bytesRead: pos - offset,
  };
}

export function parseCodec8Packet(buf: Buffer): Codec8Packet | null {
  if (buf.length < 10) return null;

  const preamble = buf.readUInt32BE(0);
  if (preamble !== 0) return null;

  const dataLength = buf.readUInt32BE(4);
  if (buf.length < 8 + dataLength + 4) return null;

  const codecId = buf.readUInt8(8);
  if (codecId !== 0x08) return null;

  const numData = buf.readUInt8(9);
  const records: AvlRecord[] = [];
  let pos = 10;

  for (let i = 0; i < numData; i++) {
    const { record, bytesRead } = parseAvlRecord(buf, pos);
    records.push(record);
    pos += bytesRead;
  }

  const numData2 = buf.readUInt8(pos);
  pos++;

  const expectedCrc = buf.readUInt32BE(pos);
  const computedCrc = crc16ibm(buf, 8, 8 + dataLength);
  const crcValid = expectedCrc === computedCrc && numData === numData2;

  return { codecId, records, crcValid };
}

export function getTotalPacketLength(buf: Buffer): number | null {
  if (buf.length < 8) return null;
  const preamble = buf.readUInt32BE(0);
  if (preamble !== 0) return null;
  const dataLength = buf.readUInt32BE(4);
  return 8 + dataLength + 4;
}

export function buildCodec12Command(command: string): Buffer {
  const cmdBuf = Buffer.from(command, "ascii");
  const dataLength = 1 + 1 + 1 + 4 + cmdBuf.length + 1;

  const payload = Buffer.allocUnsafe(dataLength);
  let pos = 0;
  payload.writeUInt8(0x0c, pos++);
  payload.writeUInt8(0x01, pos++);
  payload.writeUInt8(0x05, pos++);
  payload.writeUInt32BE(cmdBuf.length, pos);
  pos += 4;
  cmdBuf.copy(payload, pos);
  pos += cmdBuf.length;
  payload.writeUInt8(0x01, pos);

  const crc = crc16ibm(payload, 0, payload.length);

  const packet = Buffer.allocUnsafe(4 + 4 + dataLength + 4);
  packet.writeUInt32BE(0x00000000, 0);
  packet.writeUInt32BE(dataLength, 4);
  payload.copy(packet, 8);
  packet.writeUInt32BE(crc, 8 + dataLength);

  return packet;
}

export function parseCodec12Response(buf: Buffer): Codec12Packet | null {
  if (buf.length < 12) return null;
  if (buf.readUInt32BE(0) !== 0) return null;

  const dataLength = buf.readUInt32BE(4);
  if (buf.length < 8 + dataLength + 4) return null;

  const codecId = buf.readUInt8(8);
  if (codecId !== 0x0c) return null;

  const type = buf.readUInt8(10) === 0x05 ? "command" : "response";
  const contentLen = buf.readUInt32BE(11);
  const content = buf.slice(15, 15 + contentLen).toString("ascii");

  return { type, content };
}

export const TELTONIKA_COMMANDS: Record<string, string> = {
  lock: "setdigout 1 0",
  unlock: "setdigout 0 0",
  arm_alarm: "setdigout 3 0",
  disarm_alarm: "setdigout 2 0",
  locate: "getinfo",
  ping: "ping",
  disable: "setdigout 1 0",
};

export function buildTeltonikaCommand(commandType: string, payload?: Record<string, unknown>): string | null {
  if (commandType === "set_speed_limit") {
    const speedKmh = (payload?.speedKmh as number) ?? 25;
    return `setparam 382:${Math.round(speedKmh)}`;
  }
  return TELTONIKA_COMMANDS[commandType] ?? null;
}

export function extractBatteryPercent(ioElements: Record<number, number | bigint>): number | undefined {
  const val = ioElements[113];
  if (val !== undefined) return Number(val);
  return undefined;
}

export function extractIgnition(ioElements: Record<number, number | bigint>): boolean | undefined {
  const val = ioElements[239];
  if (val !== undefined) return Number(val) === 1;
  return undefined;
}

export function extractMovement(ioElements: Record<number, number | bigint>): boolean | undefined {
  const val = ioElements[240];
  if (val !== undefined) return Number(val) === 1;
  return undefined;
}

export function extractAnalogInput(ioElements: Record<number, number | bigint>): number | undefined {
  const val = ioElements[9];
  if (val !== undefined) return Number(val) / 1000.0;
  return undefined;
}
