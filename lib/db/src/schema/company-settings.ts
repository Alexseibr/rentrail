import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companySettings = pgTable("company_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 255 }).notNull(),
  value: jsonb("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanySettingSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompanySetting = z.infer<typeof insertCompanySettingSchema>;
export type CompanySetting = typeof companySettings.$inferSelect;
