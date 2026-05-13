import { db, auditLogs } from "@workspace/db";
import type { Request } from "express";

interface AuditParams {
  companyId?: string | null;
  userId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  req?: Request;
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    companyId: params.companyId ?? null,
    actorUserId: params.userId ?? params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
    metadata: params.metadata ?? null,
    ip: params.req?.ip ?? null,
    userAgent: params.req?.headers["user-agent"] ?? null,
  });
}
