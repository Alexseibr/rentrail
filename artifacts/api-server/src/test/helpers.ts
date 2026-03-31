import { db, users, companies, branches, stations, roles, permissions, rolePermissions, userCompanyMemberships, userBranchMemberships } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { signAccessToken } from "../lib/jwt";
import type { AccessTokenPayload } from "../lib/jwt";

let _rolesCache: Map<string, string> | null = null;

async function ensureRoles(): Promise<Map<string, string>> {
  if (_rolesCache && _rolesCache.size > 0) return _rolesCache;

  const existingRoles = await db.select().from(roles);
  if (existingRoles.length === 0) {
    throw new Error("Roles not seeded. Run seed-rbac first or call seedRolesAndPermissions().");
  }

  _rolesCache = new Map(existingRoles.map((r) => [r.code, r.id]));
  return _rolesCache;
}

export function clearRolesCache() {
  _rolesCache = null;
}

export interface TestUser {
  id: string;
  email: string;
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
}): Promise<TestUser> {
  const email = opts.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
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

  const payload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
  };
  const token = signAccessToken(payload);

  return { id: user.id, email: user.email, token, password };
}

export async function createTestTenant(opts?: {
  companyName?: string;
  slug?: string;
}): Promise<TestTenant> {
  const slug = opts?.slug ?? `test-co-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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

export async function assignRole(userId: string, companyId: string, roleCode: string, branchId?: string) {
  const rolesMap = await ensureRoles();
  const roleId = rolesMap.get(roleCode);
  if (!roleId) throw new Error(`Role '${roleCode}' not found. Available: ${Array.from(rolesMap.keys()).join(", ")}`);

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
      status: "active",
    });
  }
}

export function authHeaders(token: string, companyId?: string, branchId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (companyId) headers["x-company-id"] = companyId;
  if (branchId) headers["x-branch-id"] = branchId;
  return headers;
}
