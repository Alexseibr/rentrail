import { db, assets, devices } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";

interface ScanResult {
  type: "asset" | "device" | "unknown";
  entity?: Record<string, unknown>;
}

export async function resolveScannedCode(
  code: string,
  companyId: string,
): Promise<ScanResult> {
  const normalized = code.trim();

  const [assetByQr] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.companyId, companyId), eq(assets.qrCode, normalized)));
  if (assetByQr) return { type: "asset", entity: assetByQr };

  const [assetByInternal] = await db
    .select()
    .from(assets)
    .where(
      and(eq(assets.companyId, companyId), eq(assets.internalCode, normalized)),
    );
  if (assetByInternal) return { type: "asset", entity: assetByInternal };

  const [assetBySerial] = await db
    .select()
    .from(assets)
    .where(
      and(eq(assets.companyId, companyId), eq(assets.serialNumber, normalized)),
    );
  if (assetBySerial) return { type: "asset", entity: assetBySerial };

  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.companyId, companyId),
        or(
          eq(devices.externalId, normalized),
          eq(devices.serialNumber, normalized),
        ),
      ),
    );
  if (device) return { type: "device", entity: device };

  return { type: "unknown" };
}
