import { Router, type IRouter } from "express";
import { db, auditLogs, users } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import {
  requireCompanyAccess,
  requirePermission,
} from "../middlewares/authorize";

const router: IRouter = Router();

router.get(
  "/audit-logs",
  authenticate,
  requireCompanyAccess,
  requirePermission("audit:read"),
  async (req, res) => {
    const {
      entityType,
      entityId,
      action,
      actorUserId,
      from,
      to,
      page: pageParam,
      limit: limitParam,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limitParam ?? "50", 10) || 50),
    );
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(auditLogs.companyId, req.tenant!.companyId)];
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    if (entityId) conditions.push(eq(auditLogs.entityId, entityId));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (actorUserId) conditions.push(eq(auditLogs.actorUserId, actorUserId));
    if (from) conditions.push(gte(auditLogs.createdAt, new Date(from)));
    if (to) conditions.push(lte(auditLogs.createdAt, new Date(to)));

    const whereClause = and(...conditions);

    const [logs, countResult] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          actorUserId: auditLogs.actorUserId,
          actorEmail: users.email,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          action: auditLogs.action,
          before: auditLogs.before,
          after: auditLogs.after,
          metadata: auditLogs.metadata,
          ip: auditLogs.ip,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorUserId))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limitNum)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(whereClause),
    ]);

    res.json({
      data: {
        items: logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult[0]?.count ?? 0,
        },
      },
    });
  },
);

export default router;
