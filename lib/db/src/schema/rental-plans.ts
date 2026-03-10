import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { rentalTypeEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rentalPlans = pgTable(
  "rental_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    rentalType: rentalTypeEnum("rental_type").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("USD").notNull(),
    depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
    billingInterval: varchar("billing_interval", { length: 50 }),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("rental_plans_company_idx").on(t.companyId),
    index("rental_plans_type_idx").on(t.rentalType),
  ],
);

export const insertRentalPlanSchema = createInsertSchema(rentalPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentalPlan = z.infer<typeof insertRentalPlanSchema>;
export type RentalPlan = typeof rentalPlans.$inferSelect;
