import { describe, it, expect, beforeAll } from "vitest";
import { db, users, companies } from "@workspace/db";
import { sql } from "drizzle-orm";
import { cleanDatabase, cleanDatabaseFull } from "./index";

const HOOK_TIMEOUT = 15_000;

async function countRows(tableName: string): Promise<number> {
  const result = await db.execute<{ count: string }>(
    sql.raw(`SELECT COUNT(*)::int AS count FROM "${tableName}"`),
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(
    sql`SELECT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = ${tableName}
    ) AS exists`,
  );
  return result.rows[0]?.exists ?? false;
}

async function allPublicTables(): Promise<string[]> {
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  return result.rows.map((r) => r.tablename);
}

const PRESERVED_TABLES = new Set([
  "__drizzle_migrations",
  "roles",
  "permissions",
  "role_permissions",
  "platform_roles",
]);

describe("cleanDatabase", () => {
  beforeAll(async () => {
    await db.insert(users).values({
      email: `setup-test-${Date.now()}@test.com`,
      passwordHash: "hash",
      firstName: "Setup",
      lastName: "Test",
    });
    await db.insert(companies).values({
      name: "Setup Test Company",
      slug: `setup-co-${Date.now()}`,
    });

    await cleanDatabase();
  }, HOOK_TIMEOUT);

  it("truncates the users table", async () => {
    expect(await countRows("users")).toBe(0);
  });

  it("truncates the companies table", async () => {
    expect(await countRows("companies")).toBe(0);
  });

  it("preserves the roles table", async () => {
    expect(await countRows("roles")).toBeGreaterThan(0);
  });

  it("preserves the permissions table", async () => {
    expect(await countRows("permissions")).toBeGreaterThan(0);
  });

  it("preserves the role_permissions table", async () => {
    expect(await countRows("role_permissions")).toBeGreaterThan(0);
  });

  it("preserves the platform_roles table", async () => {
    expect(await countRows("platform_roles")).toBeGreaterThan(0);
  });

  it("leaves all non-preserved public tables empty", async () => {
    const tables = await allPublicTables();
    const nonPreserved = tables.filter((t) => !PRESERVED_TABLES.has(t));

    for (const table of nonPreserved) {
      expect(
        await countRows(table),
        `Expected "${table}" to be empty after cleanDatabase`,
      ).toBe(0);
    }
  });
});

describe("cleanDatabaseFull", () => {
  beforeAll(async () => {
    await cleanDatabaseFull();
  }, HOOK_TIMEOUT);

  it("wipes the roles table", async () => {
    expect(await countRows("roles")).toBe(0);
  });

  it("wipes the permissions table", async () => {
    expect(await countRows("permissions")).toBe(0);
  });

  it("wipes the role_permissions table", async () => {
    expect(await countRows("role_permissions")).toBe(0);
  });

  it("wipes the platform_roles table", async () => {
    expect(await countRows("platform_roles")).toBe(0);
  });

  it("preserves __drizzle_migrations if present", async () => {
    const exists = await tableExists("__drizzle_migrations");
    if (!exists) {
      expect(exists).toBe(false);
      return;
    }
    expect(await countRows("__drizzle_migrations")).toBeGreaterThan(0);
  });

  it("leaves no rows in any public table except __drizzle_migrations", async () => {
    const tables = await allPublicTables();
    const checkable = tables.filter((t) => t !== "__drizzle_migrations");

    for (const table of checkable) {
      expect(
        await countRows(table),
        `Expected "${table}" to be empty after cleanDatabaseFull`,
      ).toBe(0);
    }
  });
});
