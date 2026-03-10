import type { Request, Response, NextFunction } from "express";
import {
  db,
  rolePermissions,
  permissions,
  userCompanyMemberships,
  userBranchMemberships,
  roles,
  companies,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ForbiddenError, UnauthorizedError, AppError } from "../lib/errors";
import { getBody } from "../lib/request-body";

export interface TenantContext {
  companyId: string;
  companyStatus?: string;
  branchId?: string;
  membership: {
    roleId: string;
    roleCode: string;
  };
  permissions: Set<string>;
}

const COMPANY_BLOCKED_STATUSES = ["blocked", "canceled"];
const COMPANY_SUSPENDED_STATUS = "suspended";

async function loadRolePermissions(roleId: string): Promise<Set<string>> {
  const rows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId));

  return new Set(rows.map((r) => r.code));
}

async function checkCompanyStatus(companyId: string): Promise<string> {
  const [company] = await db
    .select({ status: companies.status })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    throw new ForbiddenError("Company not found");
  }

  return company.status;
}

export function requireCompanyAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
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
    const companyStatus = await checkCompanyStatus(companyId);

    if (COMPANY_BLOCKED_STATUSES.includes(companyStatus)) {
      throw new AppError(
        403,
        `Company is ${companyStatus}. Access denied.`,
        "COMPANY_BLOCKED",
      );
    }

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

    if (companyStatus === COMPANY_SUSPENDED_STATUS && req.method !== "GET") {
      throw new AppError(
        403,
        "Company is suspended. Write operations are disabled.",
        "COMPANY_SUSPENDED",
      );
    }

    req.tenant = {
      companyId,
      companyStatus,
      membership: {
        roleId: membership.roleId,
        roleCode: membership.roleCode,
      },
      permissions: perms,
    };

    next();
  })().catch(next);
}

export function rejectIfSuspended(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.user?.isSuperAdmin) {
    next();
    return;
  }

  if (req.tenant?.companyStatus === COMPANY_SUSPENDED_STATUS) {
    throw new AppError(
      403,
      "Company is suspended. Write operations are disabled.",
      "COMPANY_SUSPENDED",
    );
  }

  next();
}

export function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
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
      throw new ForbiddenError(
        `Missing permission: ${codes.filter((c) => !req.tenant!.permissions.has(c)).join(", ")}`,
      );
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
      throw new ForbiddenError(
        `Missing one of permissions: ${codes.join(", ")}`,
      );
    }

    next();
  };
}

export function requireBranchAccess() {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
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

    const reqBodyBranchId = getBody<
      Record<string, string | undefined> | undefined
    >(req)?.branchId;
    const branchId: string | undefined =
      req.tenant.branchId ||
      (req.headers["x-branch-id"] as string) ||
      reqBodyBranchId;
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
