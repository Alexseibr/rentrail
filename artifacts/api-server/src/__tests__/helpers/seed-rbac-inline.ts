import {
  db,
  roles,
  permissions,
  rolePermissions,
  platformRoles,
} from "@workspace/db";

const SYSTEM_ROLES = [
  {
    name: "superAdmin",
    displayName: "Super Admin",
    description: "Platform-level admin with full access",
    isSystem: true,
  },
  {
    name: "owner",
    displayName: "Owner",
    description: "Company owner with full company access",
    isSystem: true,
  },
  {
    name: "admin",
    displayName: "Admin",
    description: "Company administrator",
    isSystem: true,
  },
  {
    name: "manager",
    displayName: "Manager",
    description: "Branch/station manager",
    isSystem: true,
  },
  {
    name: "accountant",
    displayName: "Accountant",
    description: "Financial operations",
    isSystem: true,
  },
  {
    name: "operator",
    displayName: "Operator",
    description: "Day-to-day rental operations",
    isSystem: true,
  },
  {
    name: "mechanic",
    displayName: "Mechanic",
    description: "Asset maintenance and repairs",
    isSystem: true,
  },
  {
    name: "viewer",
    displayName: "Viewer",
    description: "Read-only access",
    isSystem: true,
  },
];

const RESOURCE_ACTIONS: Record<string, string[]> = {
  company: ["read", "update", "manage"],
  branch: ["create", "read", "update", "delete", "manage"],
  station: ["create", "read", "update", "delete", "manage"],
  client: ["create", "read", "update", "delete", "manage"],
  asset: ["create", "read", "update", "delete", "changeStatus", "manage"],
  rental: [
    "create",
    "read",
    "update",
    "approve",
    "start",
    "extend",
    "complete",
    "cancel",
    "manage",
  ],
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
  owner: Object.entries(RESOURCE_ACTIONS).flatMap(([r, actions]) =>
    actions.map((a) => `${r}:${a}`),
  ),

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
    ...permsFor("rental", [
      "create",
      "read",
      "update",
      "approve",
      "start",
      "extend",
      "complete",
      "cancel",
    ]),
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
    ...permsFor("rental", [
      "create",
      "read",
      "update",
      "start",
      "extend",
      "complete",
    ]),
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

const PLATFORM_ROLES = [
  {
    code: "superAdmin",
    name: "Super Admin",
    description: "Full platform access with all capabilities",
  },
  {
    code: "platformAdmin",
    name: "Platform Admin",
    description: "Platform administration and tenant management",
  },
  {
    code: "platformSupport",
    name: "Platform Support",
    description: "Read-only tenant inspection and support tools",
  },
  {
    code: "platformFinance",
    name: "Platform Finance",
    description: "SaaS billing, invoices, and subscription management",
  },
  {
    code: "platformRisk",
    name: "Platform Risk",
    description: "Global blacklist and risk management",
  },
];

export async function seedRolesAndPermissions() {
  await db.insert(roles).values(SYSTEM_ROLES).onConflictDoNothing();

  const permissionValues = Object.entries(RESOURCE_ACTIONS).flatMap(
    ([resource, actions]) =>
      actions.map((action) => ({
        resource,
        action,
        description: `${action} ${resource}`,
      })),
  );

  await db.insert(permissions).values(permissionValues).onConflictDoNothing();

  const [allRoles, allPermissions] = await Promise.all([
    db.select().from(roles),
    db.select().from(permissions),
  ]);

  const roleMap = new Map(allRoles.map((r) => [r.name, r.id]));
  const permMap = new Map(
    allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id]),
  );

  const rolePermissionValues = Object.entries(ROLE_PERMISSIONS).flatMap(
    ([roleCode, permCodes]) => {
      const roleId = roleMap.get(roleCode);
      if (!roleId) return [];
      return permCodes.flatMap((code) => {
        const permId = permMap.get(code);
        if (!permId) return [];
        return [{ roleId, permissionId: permId }];
      });
    },
  );

  if (rolePermissionValues.length > 0) {
    await db
      .insert(rolePermissions)
      .values(rolePermissionValues)
      .onConflictDoNothing();
  }

  await db.insert(platformRoles).values(PLATFORM_ROLES).onConflictDoNothing();
}
