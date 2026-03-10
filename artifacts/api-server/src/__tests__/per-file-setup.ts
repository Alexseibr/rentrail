import { afterAll, beforeAll } from "vitest";
import { cleanDatabase } from "./setup";
import { clearRolesCache } from "./helpers/helpers";

beforeAll(async () => {
  clearRolesCache();
  await cleanDatabase();
});

afterAll(async () => {
  clearRolesCache();
  await cleanDatabase();
});
