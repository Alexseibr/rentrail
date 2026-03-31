import { pgTable, uuid, varchar, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const companyModules = pgTable("company_modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  moduleCode: varchar("module_code", { length: 50 }).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  enabledAt: timestamp("enabled_at"),
  disabledAt: timestamp("disabled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("company_modules_company_idx").on(t.companyId),
  unique("company_modules_company_code_uniq").on(t.companyId, t.moduleCode),
]);

export type CompanyModule = typeof companyModules.$inferSelect;
