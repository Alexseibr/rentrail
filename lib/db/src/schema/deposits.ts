import { pgTable, uuid, varchar, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { rentals } from "./rentals";
import { clients } from "./clients";
import { depositStatusEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deposits = pgTable("deposits", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  status: depositStatusEnum("status").default("held").notNull(),
  heldAt: timestamp("held_at"),
  releasedAt: timestamp("released_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("deposits_company_idx").on(t.companyId),
  index("deposits_client_idx").on(t.clientId),
  index("deposits_rental_idx").on(t.rentalId),
  index("deposits_status_idx").on(t.status),
]);

export const insertDepositSchema = createInsertSchema(deposits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof deposits.$inferSelect;
