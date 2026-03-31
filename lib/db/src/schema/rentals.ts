import { pgTable, uuid, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stations } from "./stations";
import { clients } from "./clients";
import { assets } from "./assets";
import { rentalPlans } from "./rental-plans";
import { users } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rentalStatusEnum = pgEnum("rental_status", [
  "draft",
  "pending_approval",
  "awaiting_payment",
  "awaiting_pickup",
  "active",
  "extended",
  "overdue",
  "return_requested",
  "completed",
  "canceled",
  "disputed",
  "defaulted",
]);

export const rentals = pgTable("rentals", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  stationId: uuid("station_id").references(() => stations.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  assetId: uuid("asset_id").notNull().references(() => assets.id),
  rentalPlanId: uuid("rental_plan_id").references(() => rentalPlans.id),
  status: rentalStatusEnum("status").default("draft").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  expectedEndDate: timestamp("expected_end_date"),
  actualEndDate: timestamp("actual_end_date"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRentalSchema = createInsertSchema(rentals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Rental = typeof rentals.$inferSelect;
