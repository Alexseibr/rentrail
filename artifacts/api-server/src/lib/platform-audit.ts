import { db, platformAuditLogs } from "@workspace/db";
import type { Request } from "express";

interface PlatformAuditParams {
  action: string;
  entityType: string;
  entityId?: string | null;
  targetCompanyId?: string | null;
  before?: unknown;
  after?: unknown;
  reasonCode?: string | null;
  reasonText?: string | null;
}

export async function createPlatformAuditLog(
  req: Request,
  params: PlatformAuditParams,
): Promise<void> {
  const activePlatformRole =
    req.platformContext?.activePlatformRole ?? req.user?.platformRoles?.[0] ?? "unknown";

  await db.insert(platformAuditLogs).values({
    actorUserId: req.user!.userId,
    platformRole: activePlatformRole,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    targetCompanyId: params.targetCompanyId ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
    reasonCode: params.reasonCode ?? null,
    reasonText: params.reasonText ?? null,
    ip: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });
}
