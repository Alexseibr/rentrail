import { db, roles, permissions, rolePermissions } from "@workspace/db";
import { eq, and } from "drizzle-orm";

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
  crm: ["client", "inquiry", "b2b"],
  fleet: ["asset", "device", "battery"],
  operations: ["rental", "blacklist"],
  finance: ["payment", "deposit"],
  access: ["user", "role"],
  system: ["audit", "settings"],
  notifications: ["notification"],
  telemetry: ["telemetry"],
  geofencing: ["geofence"],
  commands: ["command"],
};

function getModule(resource: string): string {
  for (const [mod, resources] of Object.entries(MODULES)) {
    if (resources.includes(resource)) return mod;
  }
  return "system";
}

const RESOURCE_ACTIONS: Record<string, string[]> = {
  company: ["read", "update", "manage"],
  branch: ["create", "read", "update", "delete", "manage"],
  station: ["create", "read", "update", "delete", "manage"],
  client: ["create", "read", "update", "delete", "manage"],
  asset: ["create", "read", "update", "delete", "changeStatus", "manage"],
  rental: ["create", "read", "update", "approve", "start", "extend", "complete", "cancel", "manage"],
  blacklist: ["create", "read", "update", "check", "manage"],
  payment: ["create", "read", "refund", "manage"],
  deposit: ["create", "read", "update", "manage"],
  user: ["create", "read", "update", "delete", "manage"],
  role: ["read", "manage"],
  audit: ["read"],
  settings: ["read", "update", "manage"],
  inquiry: ["create", "read", "update", "manage"],
  b2b: ["create", "read", "update", "manage"],
  notification: ["read"],
  device: ["create", "read", "update", "changeStatus", "manage"],
  battery: ["create", "read", "update", "manage"],
  telemetry: ["read", "manage"],
  geofence: ["create", "read", "update", "manage"],
  command: ["create", "read", "manage"],
};

function permsFor(resource: string, actions: string[]): string[] {
  return actions.map((a) => `${resource}:${a}`);
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: Object.entries(RESOURCE_ACTIONS).flatMap(([r, actions]) => actions.map((a) => `${r}:${a}`)),

  admin: Object.entries(RESOURCE_ACTIONS).flatMap(([r, actions]) =>
    actions
      .filter((a) => {
        if (r === "company" && a === "manage") return false;
        if (r === "role" && a === "manage") return false;
        return true;
      })
      .map((a) => `${r}:${a}`),
  ),

  manager: [
    ...permsFor("branch", ["read", "update"]),
    ...permsFor("station", ["create", "read", "update"]),
    ...permsFor("client", ["create", "read", "update"]),
    ...permsFor("asset", ["create", "read", "update", "changeStatus"]),
    ...permsFor("rental", ["create", "read", "update", "approve", "start", "extend", "complete", "cancel"]),
    ...permsFor("blacklist", ["create", "read", "update", "check"]),
    ...permsFor("payment", ["read"]),
    ...permsFor("deposit", ["read"]),
    ...permsFor("user", ["read"]),
    ...permsFor("audit", ["read"]),
    ...permsFor("settings", ["read"]),
    ...permsFor("inquiry", ["create", "read", "update"]),
    ...permsFor("b2b", ["create", "read", "update"]),
    ...permsFor("notification", ["read"]),
    ...permsFor("device", ["create", "read", "update", "changeStatus"]),
    ...permsFor("battery", ["create", "read", "update"]),
    ...permsFor("telemetry", ["read"]),
    ...permsFor("geofence", ["create", "read", "update"]),
    ...permsFor("command", ["create", "read"]),
  ],

  accountant: [
    ...permsFor("company", ["read"]),
    ...permsFor("branch", ["read"]),
    ...permsFor("client", ["read"]),
    ...permsFor("rental", ["read"]),
    ...permsFor("payment", ["create", "read", "refund"]),
    ...permsFor("deposit", ["create", "read", "update"]),
    ...permsFor("audit", ["read"]),
    ...permsFor("settings", ["read"]),
  ],

  operator: [
    ...permsFor("branch", ["read"]),
    ...permsFor("station", ["read"]),
    ...permsFor("client", ["create", "read", "update"]),
    ...permsFor("asset", ["read", "update", "changeStatus"]),
    ...permsFor("rental", ["create", "read", "update", "start", "extend", "complete"]),
    ...permsFor("blacklist", ["read", "check"]),
    ...permsFor("payment", ["read"]),
    ...permsFor("deposit", ["read"]),
    ...permsFor("inquiry", ["read", "update"]),
    ...permsFor("b2b", ["read"]),
    ...permsFor("notification", ["read"]),
    ...permsFor("device", ["read", "update", "changeStatus"]),
    ...permsFor("battery", ["read", "update"]),
    ...permsFor("telemetry", ["read"]),
    ...permsFor("command", ["create", "read"]),
  ],

  mechanic: [
    ...permsFor("branch", ["read"]),
    ...permsFor("station", ["read"]),
    ...permsFor("asset", ["read", "update", "changeStatus"]),
    ...permsFor("device", ["read", "update", "changeStatus"]),
    ...permsFor("battery", ["read", "update"]),
    ...permsFor("telemetry", ["read"]),
    ...permsFor("command", ["create", "read"]),
  ],

  viewer: Object.keys(RESOURCE_ACTIONS)
    .filter((r) => RESOURCE_ACTIONS[r].includes("read"))
    .map((r) => `${r}:read`),
};

export async function seedRolesAndPermissions() {
  for (const role of SYSTEM_ROLES) {
    const existing = await db.select().from(roles).where(eq(roles.code, role.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(roles).values(role);
    }
  }

  const permMap = new Map<string, string>();
  for (const [resource, actions] of Object.entries(RESOURCE_ACTIONS)) {
    const module = getModule(resource);
    for (const action of actions) {
      const code = `${resource}:${action}`;
      const existing = await db.select().from(permissions).where(eq(permissions.code, code)).limit(1);
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
      } else {
        permMap.set(code, existing[0].id);
      }
    }
  }

  const allRoles = await db.select().from(roles);
  const roleMap = new Map(allRoles.map((r) => [r.code, r.id]));

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleCode);
    if (!roleId) continue;

    for (const code of permCodes) {
      const permId = permMap.get(code);
      if (!permId) continue;

      const existing = await db
        .select()
        .from(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permId)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(rolePermissions).values({ roleId, permissionId: permId });
      }
    }
  }
}
