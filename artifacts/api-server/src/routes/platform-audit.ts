import { Router, type IRouter } from "express";
import { db, platformAuditLogs, users } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { requirePlatformRole } from "../middlewares/platform-authorize";

const router: IRouter = Router();

router.get(
  "/platform/audit-logs",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin"),
  async (req, res, next) => {
    try {
      const {
        actorUserId,
        action,
        entityType,
        targetCompanyId,
        from,
        to,
        page: pageParam,
        limit: limitParam,
      } = req.query as Record<string, string | undefined>;

      const pageNum = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limitParam ?? "50", 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];
      if (actorUserId) conditions.push(eq(platformAuditLogs.actorUserId, actorUserId));
      if (action) conditions.push(eq(platformAuditLogs.action, action as string));
      if (entityType) conditions.push(eq(platformAuditLogs.entityType, entityType as string));
      if (targetCompanyId) conditions.push(eq(platformAuditLogs.targetCompanyId, targetCompanyId));
      if (from) conditions.push(gte(platformAuditLogs.createdAt, new Date(from as string)));
      if (to) conditions.push(lte(platformAuditLogs.createdAt, new Date(to as string)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [logs, countResult] = await Promise.all([
        db
          .select({
            id: platformAuditLogs.id,
            actorUserId: platformAuditLogs.actorUserId,
            actorEmail: users.email,
            actorFirstName: users.firstName,
            actorLastName: users.lastName,
            platformRole: platformAuditLogs.platformRole,
            action: platformAuditLogs.action,
            entityType: platformAuditLogs.entityType,
            entityId: platformAuditLogs.entityId,
            targetCompanyId: platformAuditLogs.targetCompanyId,
            before: platformAuditLogs.before,
            after: platformAuditLogs.after,
            reasonCode: platformAuditLogs.reasonCode,
            reasonText: platformAuditLogs.reasonText,
            ip: platformAuditLogs.ip,
            userAgent: platformAuditLogs.userAgent,
            createdAt: platformAuditLogs.createdAt,
          })
          .from(platformAuditLogs)
          .innerJoin(users, eq(users.id, platformAuditLogs.actorUserId))
          .where(whereClause)
          .orderBy(desc(platformAuditLogs.createdAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(platformAuditLogs)
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
    } catch (err) {
      next(err);
    }
  },
);

export default router;
