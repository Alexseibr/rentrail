import { describe, it, expect, beforeAll } from "vitest";
import { db, platformRoles, platformUserRoles, users } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { loadUserPlatformRoles } from "../../lib/platform-roles";
import { seedRolesAndPermissions } from "../../test/seed-rbac-inline";
import bcrypt from "bcrypt";
import crypto from "crypto";

async function createDbUser(overrides: { isSuperAdmin?: boolean } = {}) {
  const id = crypto.randomUUID();
  const ts = Date.now();
  const email = `platform-role-test-${ts}-${id.slice(0, 6)}@test.com`;
  const passwordHash = await bcrypt.hash("TestPass123!", 10);

  const [user] = await db
    .insert(users)
    .values({
      id,
      email,
      passwordHash,
      firstName: "Test",
      lastName: "User",
      isSuperAdmin: overrides.isSuperAdmin ?? false,
    })
    .returning();

  return user;
}

async function getPlatformRoleId(code: string): Promise<string> {
  const [role] = await db
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(eq(platformRoles.code, code))
    .limit(1);
  return role.id;
}

describe("loadUserPlatformRoles", () => {
  beforeAll(async () => {
    await seedRolesAndPermissions();
  });

  it("returns empty array for user with no platform roles", async () => {
    const user = await createDbUser();
    const roles = await loadUserPlatformRoles(user.id);
    expect(roles).toEqual([]);
  });

  it("returns assigned active platform roles", async () => {
    const user = await createDbUser();
    const superAdminId = await getPlatformRoleId("superAdmin");

    await db.insert(platformUserRoles).values({
      userId: user.id,
      platformRoleId: superAdminId,
      isActive: true,
    });

    const roles = await loadUserPlatformRoles(user.id);
    expect(roles).toEqual(["superAdmin"]);
  });

  it("returns multiple platform roles", async () => {
    const user = await createDbUser();
    const superAdminId = await getPlatformRoleId("superAdmin");
    const platformAdminId = await getPlatformRoleId("platformAdmin");

    await db.insert(platformUserRoles).values([
      { userId: user.id, platformRoleId: superAdminId, isActive: true },
      { userId: user.id, platformRoleId: platformAdminId, isActive: true },
    ]);

    const roles = await loadUserPlatformRoles(user.id);
    expect(roles).toContain("superAdmin");
    expect(roles).toContain("platformAdmin");
    expect(roles).toHaveLength(2);
  });

  it("excludes inactive user-role assignments", async () => {
    const user = await createDbUser();
    const superAdminId = await getPlatformRoleId("superAdmin");
    const platformAdminId = await getPlatformRoleId("platformAdmin");

    await db.insert(platformUserRoles).values([
      { userId: user.id, platformRoleId: superAdminId, isActive: true },
      { userId: user.id, platformRoleId: platformAdminId, isActive: false },
    ]);

    const roles = await loadUserPlatformRoles(user.id);
    expect(roles).toEqual(["superAdmin"]);
  });

  it("excludes roles where platform_role.isActive=false", async () => {
    const user = await createDbUser();

    const [testRole] = await db
      .insert(platformRoles)
      .values({
        code: `test-inactive-role-${Date.now()}`,
        name: "Test Inactive Role",
        description: "For testing",
        isActive: false,
      })
      .returning();

    await db.insert(platformUserRoles).values({
      userId: user.id,
      platformRoleId: testRole.id,
      isActive: true,
    });

    const roles = await loadUserPlatformRoles(user.id);
    expect(roles).toEqual([]);
  });

  it("handles revocation (isActive toggled to false)", async () => {
    const user = await createDbUser();
    const superAdminId = await getPlatformRoleId("superAdmin");

    await db.insert(platformUserRoles).values({
      userId: user.id,
      platformRoleId: superAdminId,
      isActive: true,
    });

    let roles = await loadUserPlatformRoles(user.id);
    expect(roles).toEqual(["superAdmin"]);

    await db
      .update(platformUserRoles)
      .set({ isActive: false })
      .where(
        and(
          eq(platformUserRoles.userId, user.id),
          eq(platformUserRoles.platformRoleId, superAdminId),
        ),
      );

    roles = await loadUserPlatformRoles(user.id);
    expect(roles).toEqual([]);
  });

  it("returns empty array for non-existent user", async () => {
    const roles = await loadUserPlatformRoles(crypto.randomUUID());
    expect(roles).toEqual([]);
  });
});
