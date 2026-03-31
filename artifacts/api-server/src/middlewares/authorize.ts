import type { Request, Response, NextFunction } from "express";
import { db, rolePermissions, permissions, userCompanyMemberships, userBranchMemberships, roles } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

export interface TenantContext {
  companyId: string;
  branchId?: string;
  membership: {
    roleId: string;
    roleCode: string;
  };
  permissions: Set<string>;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

async function loadRolePermissions(roleId: string): Promise<Set<string>> {
  const rows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId));

  return new Set(rows.map((r) => r.code));
}

export function requireCompanyAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const companyId = req.headers["x-company-id"] as string;
  if (!companyId) {
    throw new ForbiddenError("Missing x-company-id header");
  }

  if (req.user.isSuperAdmin) {
    req.tenant = {
      companyId,
      membership: { roleId: "", roleCode: "superAdmin" },
      permissions: new Set(),
    };
    next();
    return;
  }

  (async () => {
    const [membership] = await db
      .select({
        roleId: userCompanyMemberships.roleId,
        roleCode: roles.code,
        status: userCompanyMemberships.status,
      })
      .from(userCompanyMemberships)
      .innerJoin(roles, eq(roles.id, userCompanyMemberships.roleId))
      .where(
        and(
          eq(userCompanyMemberships.userId, req.user!.userId),
          eq(userCompanyMemberships.companyId, companyId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenError("No membership in this company");
    }

    if (membership.status !== "active") {
      throw new ForbiddenError("Company membership is not active");
    }

    const perms = await loadRolePermissions(membership.roleId);

    req.tenant = {
      companyId,
      membership: {
        roleId: membership.roleId,
        roleCode: membership.roleCode,
      },
      permissions: perms,
    };

    next();
  })().catch(next);
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  if (!req.user.isSuperAdmin) {
    throw new ForbiddenError("Super admin access required");
  }
  next();
}

export function requirePermission(...codes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    if (!req.tenant) {
      throw new ForbiddenError("Company context not set");
    }

    const hasAll = codes.every((code) => req.tenant!.permissions.has(code));
    if (!hasAll) {
      throw new ForbiddenError(`Missing permission: ${codes.filter((c) => !req.tenant!.permissions.has(c)).join(", ")}`);
    }

    next();
  };
}

export function requireAnyPermission(...codes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    if (!req.tenant) {
      throw new ForbiddenError("Company context not set");
    }

    const hasAny = codes.some((code) => req.tenant!.permissions.has(code));
    if (!hasAny) {
      throw new ForbiddenError(`Missing one of permissions: ${codes.join(", ")}`);
    }

    next();
  };
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

    const [branchMembership] = await db
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

    if (!branchMembership) {
      throw new ForbiddenError("No access to this branch");
    }

    req.tenant.branchId = branchId;
    next();
  };
}
