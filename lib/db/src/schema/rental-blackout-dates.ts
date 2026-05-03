import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { assets } from "./assets";
import { users } from "./users";

export const rentalBlackoutDates = pgTable("rental_blackout_dates", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  assetId: uuid("asset_id").references(() => assets.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("blackout_company_idx").on(t.companyId),
  index("blackout_branch_idx").on(t.branchId),
  index("blackout_asset_idx").on(t.assetId),
  index("blackout_dates_idx").on(t.startDate, t.endDate),
]);

export type RentalBlackoutDate = typeof rentalBlackoutDates.$inferSelect;
