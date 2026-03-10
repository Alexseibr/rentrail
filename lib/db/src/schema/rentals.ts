import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stations } from "./stations";
import { clients } from "./clients";
import { assets } from "./assets";
import { rentalPlans } from "./rental-plans";
import { users } from "./users";
import { rentalStatusEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rentals = pgTable(
  "rentals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id),
    stationId: uuid("station_id").references(() => stations.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    rentalPlanId: uuid("rental_plan_id").references(() => rentalPlans.id),
    status: rentalStatusEnum("status").default("draft").notNull(),
    tariffSnapshot: jsonb("tariff_snapshot"),
    depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
    startAt: timestamp("start_at"),
    plannedEndAt: timestamp("planned_end_at"),
    actualEndAt: timestamp("actual_end_at"),
    issuedByUserId: uuid("issued_by_user_id").references(() => users.id),
    returnedToStationId: uuid("returned_to_station_id").references(
      () => stations.id,
    ),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("rentals_company_idx").on(t.companyId),
    index("rentals_branch_idx").on(t.branchId),
    index("rentals_client_idx").on(t.clientId),
    index("rentals_asset_idx").on(t.assetId),
    index("rentals_status_idx").on(t.status),
    index("rentals_start_idx").on(t.startAt),
    index("rentals_planned_end_idx").on(t.plannedEndAt),
    index("rentals_company_status_idx").on(t.companyId, t.status),
    index("rentals_company_client_status_idx").on(
      t.companyId,
      t.clientId,
      t.status,
    ),
    index("rentals_company_asset_status_idx").on(
      t.companyId,
      t.assetId,
      t.status,
    ),
  ],
);

export const insertRentalSchema = createInsertSchema(rentals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Rental = typeof rentals.$inferSelect;
