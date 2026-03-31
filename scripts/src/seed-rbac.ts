import { db, roles, permissions, rolePermissions } from "@workspace/db";
import { eq } from "drizzle-orm";

const SYSTEM_ROLES = [
  { code: "superAdmin", name: "Super Admin", description: "Platform-level admin with full access", isSystem: true },
  { code: "owner", name: "Owner", description: "Company owner with full company access", isSystem: true },
  { code: "admin", name: "Admin", description: "Company administrator", isSystem: true },
  { code: "manager", name: "Manager", description: "Branch/station manager", isSystem: true },
  { code: "accountant", name: "Accountant", description: "Financial operations", isSystem: true },
  { code: "operator", name: "Operator", description: "Day-to-day rental operations", isSystem: true },
  { code: "mechanic", name: "Mechanic", description: "Asset maintenance and repairs", isSystem: true },
  { code: "viewer", name: "Viewer", description: "Read-only access", isSystem: true },
];

const MODULES: Record<string, string[]> = {
  platform: ["company"],
  organization: ["branch", "station"],
  crm: ["client"],
  fleet: ["asset"],
  operations: ["rental", "blacklist"],
  finance: ["payment", "deposit"],
  access: ["user", "role"],
  system: ["audit", "settings"],
};

const RESOURCES = Object.values(MODULES).flat();
const ACTIONS = ["create", "read", "update", "delete", "manage"];

function getModule(resource: string): string {
  for (const [mod, resources] of Object.entries(MODULES)) {
    if (resources.includes(resource)) return mod;
  }
  return "system";
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: RESOURCES.flatMap((r) => ACTIONS.map((a) => `${r}:${a}`)),
  admin: RESOURCES.flatMap((r) =>
    ACTIONS.filter((a) => a !== "delete" || !["company", "role"].includes(r)).map((a) => `${r}:${a}`),
  ),
  manager: ["branch", "station", "client", "asset", "rental", "blacklist"]
    .flatMap((r) => ["create", "read", "update"].map((a) => `${r}:${a}`))
    .concat(["payment:read", "deposit:read", "user:read", "audit:read"]),
  accountant: ["payment", "deposit"]
    .flatMap((r) => ACTIONS.map((a) => `${r}:${a}`))
    .concat(["rental:read", "client:read", "company:read", "branch:read", "audit:read"]),
  operator: ["client", "asset", "rental"]
    .flatMap((r) => ["create", "read", "update"].map((a) => `${r}:${a}`))
    .concat(["branch:read", "station:read", "blacklist:read", "payment:read"]),
  mechanic: ["asset:read", "asset:update", "branch:read", "station:read"],
  viewer: RESOURCES.map((r) => `${r}:read`),
};

async function seed() {
  console.log("Seeding roles...");

  for (const role of SYSTEM_ROLES) {
    const existing = await db.select().from(roles).where(eq(roles.code, role.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(roles).values(role);
      console.log(`  Created role: ${role.code}`);
    } else {
      console.log(`  Role exists: ${role.code}`);
    }
  }

  console.log("Seeding permissions...");

  const permMap = new Map<string, string>();
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const code = `${resource}:${action}`;
      const module = getModule(resource);

      const existing = await db
        .select()
        .from(permissions)
        .where(eq(permissions.code, code))
        .limit(1);

      if (existing.length === 0) {
        const [perm] = await db
          .insert(permissions)
          .values({
            code,
            name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource}`,
            module,
            description: `${action} ${resource}`,
          })
          .returning();
        permMap.set(code, perm.id);
        console.log(`  Created permission: ${code} (${module})`);
      } else {
        permMap.set(code, existing[0].id);
      }
    }
  }

  console.log("Seeding role-permission mappings...");

  const allRoles = await db.select().from(roles);
  const roleMap = new Map(allRoles.map((r) => [r.code, r.id]));

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleCode);
    if (!roleId) continue;

    for (const code of permCodes) {
      const permId = permMap.get(code);
      if (!permId) continue;

      try {
        await db.insert(rolePermissions).values({ roleId, permissionId: permId });
      } catch {
        // Already exists
      }
    }
    console.log(`  Mapped ${permCodes.length} permissions to role: ${roleCode}`);
  }

  console.log("RBAC seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
