import type { Request, Response, NextFunction } from "express";
import { db, rolePermissions, permissions, userCompanyMemberships, userBranchMemberships, roles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

export interface TenantContext {
  companyId: string;
  branchId?: string;
  membership: {
    roleId: string;
    roleCode: string;
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
  req.tenant = { companyId, membership: { roleId: "", roleCode: "" } };
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (req.user.isSuperAdmin) {
      const companyId = req.headers["x-company-id"] as string || "";
      req.tenant = req.tenant || { companyId, membership: { roleId: "", roleCode: "superAdmin" } };
      req.tenant.membership = { roleId: "", roleCode: "superAdmin" };
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
        roleCode: roles.code,
        status: userCompanyMemberships.status,
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

    const userMembership = membership[0];

    if (userMembership.status !== "active") {
      throw new ForbiddenError("Company membership is not active");
    }

    if (!allowedRoles.includes(userMembership.roleCode)) {
      throw new ForbiddenError("Insufficient role permissions");
    }

    req.tenant = {
      companyId,
      membership: {
        roleId: userMembership.roleId,
        roleCode: userMembership.roleCode,
      },
    };

    next();
  };
}

export function requireBranch(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  if (!req.tenant) {
    throw new ForbiddenError("Tenant context not set");
  }

  if (req.user.isSuperAdmin) {
    next();
    return;
  }

  const branchId = req.headers["x-branch-id"] as string;
  if (branchId) {
    req.tenant.branchId = branchId;
  }

  next();
}

export function requireBranchAccess() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.tenant) {
      throw new UnauthorizedError();
    }

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    const roleCode = req.tenant.membership.roleCode;
    if (["owner", "admin"].includes(roleCode)) {
      next();
      return;
    }

    const branchId = req.tenant.branchId || req.headers["x-branch-id"] as string || req.body?.branchId;
    if (!branchId) {
      next();
      return;
    }

    const branchMembership = await db
      .select({ id: userBranchMemberships.id })
      .from(userBranchMemberships)
      .where(
        and(
          eq(userBranchMemberships.userId, req.user.userId),
          eq(userBranchMemberships.companyId, req.tenant.companyId),
          eq(userBranchMemberships.branchId, branchId),
          eq(userBranchMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (branchMembership.length === 0) {
      throw new ForbiddenError("No access to this branch");
    }

    req.tenant.branchId = branchId;
    next();
  };
}

export function requirePermission(permissionCode: string) {
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
          eq(permissions.code, permissionCode),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      throw new ForbiddenError(`Missing permission: ${permissionCode}`);
    }

    next();
  };
}
