import { pool } from "@workspace/db";
import { cleanDatabaseFull } from "./setup";
import { seedRolesAndPermissions } from "./helpers/seed-rbac-inline";

export async function setup() {
  await cleanDatabaseFull();
  await seedRolesAndPermissions();
}

export async function teardown() {
  await cleanDatabaseFull();
  await pool.end();
}
