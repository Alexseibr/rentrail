import {
  db,
  users,
  companies,
  branches,
  stations,
  roles,
  userCompanyMemberships,
  userBranchMemberships,
  clients,
  assets,
  platformRoles,
  platformUserRoles,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { signAccessToken } from "../../lib/jwt";
import type { AccessTokenPayload } from "../../lib/jwt";
import { seedRolesAndPermissions } from "./seed-rbac-inline";

let _rolesCache: Map<string, string> | null = null;
let _seeding: Promise<void> | null = null;

async function ensureRolesSeeded(): Promise<void> {
  if (_seeding) return _seeding;
  _seeding = seedRolesAndPermissions().finally(() => {
    _seeding = null;
  });
  return _seeding;
}

async function ensureRoles(): Promise<Map<string, string>> {
  if (_rolesCache && _rolesCache.size > 0) return _rolesCache;

  const existingRoles = await db.select().from(roles);
  if (existingRoles.length === 0) {
    await ensureRolesSeeded();
    const seededRoles = await db.select().from(roles);
    _rolesCache = new Map(seededRoles.map((r) => [r.code, r.id]));
    return _rolesCache;
  }

  _rolesCache = new Map(existingRoles.map((r) => [r.code, r.id]));
  return _rolesCache;
}

export function clearRolesCache() {
  _rolesCache = null;
}

export interface TestUser {
  id: string;
  email: string | undefined;
  token: string;
  password: string;
}

export interface TestTenant {
  company: { id: string; name: string; slug: string };
  branch: { id: string; name: string };
  station: { id: string; name: string };
}

export async function createTestUser(opts: {
  email?: string;
  password?: string;
  isSuperAdmin?: boolean;
  firstName?: string;
  lastName?: string;
  platformRoleCodes?: string[];
}): Promise<TestUser> {
  const email =
    opts.email ??
    `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const password = opts.password ?? "TestPass123!";
  const passwordHash = await bcrypt.hash(password, 4);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      firstName: opts.firstName ?? "Test",
      lastName: opts.lastName ?? "User",
      isSuperAdmin: opts.isSuperAdmin ?? false,
    })
    .returning();

  const assignedRoleCodes: string[] = [];
  if (opts.platformRoleCodes && opts.platformRoleCodes.length > 0) {
    const existingPlatformRoles = await db.select().from(platformRoles);
    if (existingPlatformRoles.length === 0) {
      await ensureRolesSeeded();
    }
    for (const code of opts.platformRoleCodes) {
      const [role] = await db
        .select()
        .from(platformRoles)
        .where(eq(platformRoles.code, code))
        .limit(1);
      if (role) {
        await db.insert(platformUserRoles).values({
          userId: user.id,
          platformRoleId: role.id,
          isActive: true,
        });
        assignedRoleCodes.push(code);
      }
    }
  }

  const payload: AccessTokenPayload = {
    userId: user.id,
    email: user.email ?? undefined,
    isSuperAdmin: user.isSuperAdmin || assignedRoleCodes.includes("superAdmin"),
    platformRoles: assignedRoleCodes,
  };
  const token = signAccessToken(payload);

  return { id: user.id, email: user.email ?? undefined, token, password };
}

export async function createTestTenant(opts?: {
  companyName?: string;
  slug?: string;
}): Promise<TestTenant> {
  const slug =
    opts?.slug ??
    `test-co-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const [company] = await db
    .insert(companies)
    .values({
      name: opts?.companyName ?? "Test Company",
      slug,
    })
    .returning();

  const [branch] = await db
    .insert(branches)
    .values({
      companyId: company.id,
      name: "Main Branch",
    })
    .returning();

  const [station] = await db
    .insert(stations)
    .values({
      companyId: company.id,
      branchId: branch.id,
      name: "Station A",
    })
    .returning();

  return {
    company: { id: company.id, name: company.name, slug: company.slug },
    branch: { id: branch.id, name: branch.name },
    station: { id: station.id, name: station.name },
  };
}

export async function assignRole(
  userId: string,
  companyId: string,
  roleCode: string,
  branchId?: string,
) {
  const rolesMap = await ensureRoles();
  const roleId = rolesMap.get(roleCode);
  if (!roleId)
    throw new Error(
      `Role '${roleCode}' not found. Available: ${Array.from(rolesMap.keys()).join(", ")}`,
    );

  await db.insert(userCompanyMemberships).values({
    userId,
    companyId,
    roleId,
    status: "active",
  });

  if (branchId) {
    await db.insert(userBranchMemberships).values({
      userId,
      companyId,
      branchId,
      roleId,
      status: "active",
    });
  }
}

export function authHeaders(
  token: string,
  companyId?: string,
  branchId?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (companyId) headers["x-company-id"] = companyId;
  if (branchId) headers["x-branch-id"] = branchId;
  return headers;
}

export async function createTestClient(
  companyId: string,
  opts?: { fullName?: string; phone?: string; email?: string },
) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const [client] = await db
    .insert(clients)
    .values({
      companyId,
      fullName: opts?.fullName ?? `Client ${suffix}`,
      phone:
        opts?.phone ??
        `+1${suffix.replace(/\D/g, "").slice(0, 10).padEnd(10, "0")}`,
      email: opts?.email ?? `client-${suffix}@test.com`,
    })
    .returning();
  return client;
}

export async function createTestAsset(
  companyId: string,
  branchId: string,
  opts?: {
    stationId?: string;
    assetType?: string;
    status?: string;
    internalCode?: string;
  },
) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const [asset] = await db
    .insert(assets)
    .values({
      companyId,
      branchId,
      stationId: opts?.stationId ?? null,
      assetType: (opts?.assetType ?? "bike") as
        | "bike"
        | "ebike"
        | "scooter"
        | "escooter",
      status: (opts?.status ??
        "available") as typeof assets.$inferInsert.status,
      internalCode: opts?.internalCode ?? `ASSET-${suffix}`,
    })
    .returning();
  return asset;
}
