const ROLE_TAB_ACCESS: Record<string, string[]> = {
  owner: ["index", "assets", "rentals", "operations", "settings"],
  admin: ["index", "assets", "rentals", "operations", "settings"],
  manager: ["index", "assets", "rentals", "operations"],
  operator: ["index", "assets", "rentals"],
  mechanic: ["assets", "operations"],
  accountant: ["index", "rentals"],
  viewer: ["index", "assets", "rentals", "operations", "settings"],
};

export function canAccessTab(roleCode: string | undefined, tabName: string): boolean {
  if (!roleCode) return false;
  const allowed = ROLE_TAB_ACCESS[roleCode];
  if (!allowed) return false;
  return allowed.includes(tabName);
}

export function isReadOnly(roleCode: string | undefined): boolean {
  return roleCode === "viewer";
}
