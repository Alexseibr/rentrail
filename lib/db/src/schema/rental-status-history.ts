import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { rentals } from "./rentals";
import { users } from "./users";
import { rentalStatusEnum } from "./enums";

export const rentalStatusHistory = pgTable("rental_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  rentalId: uuid("rental_id").notNull().references(() => rentals.id, { onDelete: "cascade" }),
  fromStatus: rentalStatusEnum("from_status"),
  toStatus: rentalStatusEnum("to_status").notNull(),
  reason: text("reason"),
  changedByUserId: uuid("changed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("rsh_rental_idx").on(t.rentalId),
  index("rsh_company_idx").on(t.companyId),
  index("rsh_created_idx").on(t.createdAt),
]);

export type RentalStatusHistory = typeof rentalStatusHistory.$inferSelect;
