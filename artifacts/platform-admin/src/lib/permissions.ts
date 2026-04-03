const ROLE_NAV_ACCESS: Record<string, string[]> = {
  owner: ["/", "/fleet", "/map", "/service", "/rentals", "/clients", "/branches", "/settings"],
  admin: ["/", "/fleet", "/map", "/service", "/rentals", "/clients", "/branches", "/settings"],
  manager: ["/", "/fleet", "/map", "/service", "/rentals", "/clients", "/branches"],
  operator: ["/", "/fleet", "/map", "/rentals", "/clients"],
  mechanic: ["/fleet", "/map", "/service"],
  accountant: ["/", "/rentals"],
  viewer: ["/", "/fleet", "/map", "/service", "/rentals", "/clients", "/branches", "/settings"],
};

const ROLE_WRITE_ACCESS: Record<string, string[]> = {
  owner: ["asset", "rental", "client", "branch", "settings", "service", "user", "role"],
  admin: ["asset", "rental", "client", "branch", "settings", "service", "user"],
  manager: ["asset", "rental", "client", "service", "branch"],
  operator: ["rental", "client", "asset"],
  mechanic: ["asset", "service"],
  accountant: ["payment", "deposit"],
  viewer: [],
};

export function canAccessRoute(roleCode: string | undefined, path: string): boolean {
  if (!roleCode) return false;
  const allowed = ROLE_NAV_ACCESS[roleCode];
  if (!allowed) return false;
  if (path === "/" || path === "") return allowed.includes("/");
  return allowed.some((p) => p !== "/" && path.startsWith(p));
}

export function canWrite(roleCode: string | undefined, resource: string): boolean {
  if (!roleCode) return false;
  const allowed = ROLE_WRITE_ACCESS[roleCode];
  if (!allowed) return false;
  return allowed.includes(resource);
}

export function getNavPaths(roleCode: string | undefined): string[] {
  if (!roleCode) return [];
  return ROLE_NAV_ACCESS[roleCode] || [];
}

export function isReadOnly(roleCode: string | undefined): boolean {
  return roleCode === "viewer";
}
