import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { saasBillingIntervalEnum } from "./enums";

export const saasPlans = pgTable("saas_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  price: integer("price").notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  billingInterval: saasBillingIntervalEnum("billing_interval").default("monthly").notNull(),
  limits: jsonb("limits").$type<Record<string, number>>().default({}).notNull(),
  enabledModules: jsonb("enabled_modules").$type<string[]>().default([]).notNull(),
  whiteLabelAvailable: boolean("white_label_available").default(false).notNull(),
  supportTier: varchar("support_tier", { length: 50 }).default("standard").notNull(),
  maxBranches: integer("max_branches").default(-1).notNull(),
  maxStations: integer("max_stations").default(-1).notNull(),
  maxAssets: integer("max_assets").default(-1).notNull(),
  maxUsers: integer("max_users").default(-1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("saas_plans_code_idx").on(t.code),
  index("saas_plans_active_idx").on(t.isActive),
]);

export const insertSaasPlanSchema = createInsertSchema(saasPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSaasPlan = z.infer<typeof insertSaasPlanSchema>;
export type SaasPlan = typeof saasPlans.$inferSelect;
