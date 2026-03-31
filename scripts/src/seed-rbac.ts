import { db, roles, permissions, rolePermissions } from "@workspace/db";
import { eq } from "drizzle-orm";

const SYSTEM_ROLES = [
  { name: "superAdmin", displayName: "Super Admin", description: "Platform-level admin with full access", isSystem: true },
  { name: "owner", displayName: "Owner", description: "Company owner with full company access", isSystem: true },
  { name: "admin", displayName: "Admin", description: "Company administrator", isSystem: true },
  { name: "manager", displayName: "Manager", description: "Branch/station manager", isSystem: true },
  { name: "accountant", displayName: "Accountant", description: "Financial operations", isSystem: true },
  { name: "operator", displayName: "Operator", description: "Day-to-day rental operations", isSystem: true },
  { name: "mechanic", displayName: "Mechanic", description: "Asset maintenance and repairs", isSystem: true },
  { name: "viewer", displayName: "Viewer", description: "Read-only access", isSystem: true },
];

const RESOURCES = ["company", "branch", "station", "client", "asset", "rental", "blacklist", "payment", "deposit", "user", "role", "audit"];
const ACTIONS = ["create", "read", "update", "delete", "manage"];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: RESOURCES.flatMap((r) => ACTIONS.map((a) => `${r}:${a}`)),
  admin: RESOURCES.flatMap((r) => ACTIONS.filter((a) => a !== "delete" || !["company", "role"].includes(r)).map((a) => `${r}:${a}`)),
  manager: ["branch", "station", "client", "asset", "rental", "blacklist"].flatMap((r) => ["create", "read", "update"].map((a) => `${r}:${a}`)).concat(["payment:read", "deposit:read", "user:read", "audit:read"]),
  accountant: ["payment", "deposit"].flatMap((r) => ACTIONS.map((a) => `${r}:${a}`)).concat(["rental:read", "client:read", "company:read", "branch:read", "audit:read"]),
  operator: ["client", "asset", "rental"].flatMap((r) => ["create", "read", "update"].map((a) => `${r}:${a}`)).concat(["branch:read", "station:read", "blacklist:read", "payment:read"]),
  mechanic: ["asset:read", "asset:update", "branch:read", "station:read"],
  viewer: RESOURCES.map((r) => `${r}:read`),
};

async function seed() {
  console.log("Seeding roles...");

  for (const role of SYSTEM_ROLES) {
    const existing = await db.select().from(roles).where(eq(roles.name, role.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(roles).values(role);
      console.log(`  Created role: ${role.name}`);
    } else {
      console.log(`  Role exists: ${role.name}`);
    }
  }

  console.log("Seeding permissions...");

  const permMap = new Map<string, string>();
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const key = `${resource}:${action}`;
      const existing = await db
        .select()
        .from(permissions)
        .where(eq(permissions.resource, resource))
        .limit(100);

      const found = existing.find((p) => p.action === action);
      if (!found) {
        const [perm] = await db
          .insert(permissions)
          .values({ resource, action, description: `${action} ${resource}` })
          .returning();
        permMap.set(key, perm.id);
        console.log(`  Created permission: ${key}`);
      } else {
        permMap.set(key, found.id);
      }
    }
  }

  console.log("Seeding role-permission mappings...");

  const allRoles = await db.select().from(roles);
  const roleMap = new Map(allRoles.map((r) => [r.name, r.id]));

  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) continue;

    for (const key of permKeys) {
      const permId = permMap.get(key);
      if (!permId) continue;

      try {
        await db.insert(rolePermissions).values({ roleId, permissionId: permId });
      } catch {
        // Already exists
      }
    }
    console.log(`  Mapped ${permKeys.length} permissions to role: ${roleName}`);
  }

  console.log("RBAC seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
