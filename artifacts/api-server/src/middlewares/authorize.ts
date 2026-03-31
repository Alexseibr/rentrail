import type { Request, Response, NextFunction } from "express";
import { db, rolePermissions, permissions, userCompanyMemberships, roles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

export interface TenantContext {
  companyId: string;
  membership: {
    roleId: string;
    roleName: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export function requireCompany(req: Request, _res: Response, next: NextFunction): void {
  const companyId = req.headers["x-company-id"] as string;
  if (!companyId) {
    throw new ForbiddenError("Missing x-company-id header");
  }
  if (!req.user) {
    throw new UnauthorizedError();
  }
  req.tenant = { companyId, membership: { roleId: "", roleName: "" } };
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (req.user.isSuperAdmin) {
      req.tenant = req.tenant || { companyId: req.headers["x-company-id"] as string || "", membership: { roleId: "", roleName: "superAdmin" } };
      if (req.tenant) {
        req.tenant.membership = { roleId: "", roleName: "superAdmin" };
      }
      next();
      return;
    }

    const companyId = req.headers["x-company-id"] as string;
    if (!companyId) {
      throw new ForbiddenError("Missing x-company-id header");
    }

    const membership = await db
      .select({
        roleId: userCompanyMemberships.roleId,
        roleName: roles.name,
      })
      .from(userCompanyMemberships)
      .innerJoin(roles, eq(roles.id, userCompanyMemberships.roleId))
      .where(
        and(
          eq(userCompanyMemberships.userId, req.user.userId),
          eq(userCompanyMemberships.companyId, companyId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenError("No membership in this company");
    }

    const userRole = membership[0];
    if (!allowedRoles.includes(userRole.roleName)) {
      throw new ForbiddenError("Insufficient role permissions");
    }

    req.tenant = {
      companyId,
      membership: {
        roleId: userRole.roleId,
        roleName: userRole.roleName,
      },
    };

    next();
  };
}

export function requirePermission(resource: string, action: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    if (!req.tenant) {
      throw new ForbiddenError("Tenant context not set");
    }

    const result = await db
      .select({ id: permissions.id })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        and(
          eq(rolePermissions.roleId, req.tenant.membership.roleId),
          eq(permissions.resource, resource),
          eq(permissions.action, action),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      throw new ForbiddenError(`Missing permission: ${resource}:${action}`);
    }

    next();
  };
}
