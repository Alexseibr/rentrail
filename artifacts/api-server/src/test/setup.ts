import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const PRESERVED_TABLES = new Set([
  "__drizzle_migrations",
  "roles",
  "permissions",
  "role_permissions",
]);

export async function cleanDatabase() {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  for (const { tablename } of tables.rows) {
    if (PRESERVED_TABLES.has(tablename)) continue;
    await db.execute(sql.raw(`TRUNCATE TABLE "${tablename}" CASCADE`));
  }
}

export async function cleanDatabaseFull() {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '__drizzle_migrations'`,
  );
  for (const { tablename } of tables.rows) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${tablename}" CASCADE`));
  }
}
