import { db, providerApiKeys } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { NotFoundError } from "../lib/errors";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function generateApiKey(
  companyId: string,
  data: { provider: string; name: string },
) {
  const rawKey = `pk_${randomBytes(32).toString("hex")}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 10);

  const [record] = await db
    .insert(providerApiKeys)
    .values({
      companyId,
      provider: data.provider,
      name: data.name,
      keyHash,
      keyPrefix,
    })
    .returning();

  return { ...record, rawKey };
}

export async function listApiKeys(companyId: string) {
  return db
    .select({
      id: providerApiKeys.id,
      companyId: providerApiKeys.companyId,
      provider: providerApiKeys.provider,
      name: providerApiKeys.name,
      keyPrefix: providerApiKeys.keyPrefix,
      isActive: providerApiKeys.isActive,
      lastUsedAt: providerApiKeys.lastUsedAt,
      createdAt: providerApiKeys.createdAt,
      revokedAt: providerApiKeys.revokedAt,
    })
    .from(providerApiKeys)
    .where(eq(providerApiKeys.companyId, companyId));
}

export async function revokeApiKey(id: string, companyId: string) {
  const [updated] = await db
    .update(providerApiKeys)
    .set({ isActive: false, revokedAt: new Date() })
    .where(
      and(eq(providerApiKeys.id, id), eq(providerApiKeys.companyId, companyId)),
    )
    .returning();
  if (!updated) throw new NotFoundError("API key not found");
  return updated;
}

export async function resolveApiKey(rawKey: string) {
  const keyHash = hashKey(rawKey);
  const [record] = await db
    .select()
    .from(providerApiKeys)
    .where(
      and(
        eq(providerApiKeys.keyHash, keyHash),
        eq(providerApiKeys.isActive, true),
      ),
    )
    .limit(1);
  if (!record) return null;

  await db
    .update(providerApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(providerApiKeys.id, record.id));
  return {
    companyId: record.companyId,
    provider: record.provider,
    keyId: record.id,
  };
}
