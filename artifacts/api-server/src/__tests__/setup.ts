import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const PRESERVED_TABLES = new Set([
  "__drizzle_migrations",
  "roles",
  "permissions",
  "role_permissions",
  "platform_roles",
]);

let cachedAllTables: string[] | null = null;

async function getAllTables(): Promise<string[]> {
  if (cachedAllTables !== null) return cachedAllTables;
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  cachedAllTables = tables.rows.map((r) => r.tablename);
  return cachedAllTables;
}

export function resetTableCache(): void {
  cachedAllTables = null;
}

export async function cleanDatabase() {
  const allTables = await getAllTables();
  const toTruncate = allTables.filter((t) => !PRESERVED_TABLES.has(t));
  if (toTruncate.length === 0) return;
  const list = toTruncate.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} CASCADE`));
}

export async function cleanDatabaseFull() {
  const allTables = await getAllTables();
  const toTruncate = allTables.filter((t) => t !== "__drizzle_migrations");
  if (toTruncate.length === 0) return;
  const list = toTruncate.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} CASCADE`));
}
