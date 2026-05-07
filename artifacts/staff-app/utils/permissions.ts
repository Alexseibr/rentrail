const ROLE_TAB_ACCESS: Record<string, string[]> = {
  owner: [
    "index",
    "my-shift",
    "assets",
    "map",
    "rentals",
    "operations",
    "settings",
  ],
  admin: [
    "index",
    "my-shift",
    "assets",
    "map",
    "rentals",
    "operations",
    "settings",
  ],
  manager: ["index", "assets", "map", "rentals", "operations"],
  operator: ["index", "assets", "rentals"],
  mechanic: ["my-shift", "assets", "operations"],
  accountant: ["index", "rentals"],
  viewer: ["index", "assets", "map", "rentals", "operations", "settings"],
};

export function canAccessTab(
  roleCode: string | undefined,
  tabName: string,
): boolean {
  if (!roleCode) return false;
  const allowed = ROLE_TAB_ACCESS[roleCode];
  if (!allowed) return false;
  return allowed.includes(tabName);
}

export function isReadOnly(roleCode: string | undefined): boolean {
  return roleCode === "viewer";
}
