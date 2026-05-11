import { db, auditLogs } from "@workspace/db";
import type { Request } from "express";

interface AuditParams {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  req?: Request;
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    companyId: params.companyId ?? null,
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    oldValues: params.oldValues ?? null,
    newValues: params.newValues ?? null,
    ipAddress: params.req?.ip ?? null,
    userAgent: params.req?.headers["user-agent"] ?? null,
  });
}
