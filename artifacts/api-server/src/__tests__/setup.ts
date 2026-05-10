import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const PRESERVED_TABLES = new Set([
  "__drizzle_migrations",
  "roles",
  "permissions",
  "role_permissions",
  "platform_roles",
]);

export async function cleanDatabase() {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const toTruncate = tables.rows
    .map((r) => r.tablename)
    .filter((t) => !PRESERVED_TABLES.has(t));
  if (toTruncate.length === 0) return;
  const list = toTruncate.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} CASCADE`));
}

export async function cleanDatabaseFull() {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '__drizzle_migrations'`,
  );
  const toTruncate = tables.rows.map((r) => r.tablename);
  if (toTruncate.length === 0) return;
  const list = toTruncate.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} CASCADE`));
}
