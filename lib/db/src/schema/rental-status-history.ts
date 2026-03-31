import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { rentals, rentalStatusEnum } from "./rentals";
import { users } from "./users";

export const rentalStatusHistory = pgTable("rental_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  rentalId: uuid("rental_id").notNull().references(() => rentals.id, { onDelete: "cascade" }),
  previousStatus: rentalStatusEnum("previous_status"),
  newStatus: rentalStatusEnum("new_status").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RentalStatusHistory = typeof rentalStatusHistory.$inferSelect;
