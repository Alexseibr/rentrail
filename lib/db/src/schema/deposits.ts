import { pgTable, uuid, varchar, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { rentals } from "./rentals";
import { clients } from "./clients";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const depositStatusEnum = pgEnum("deposit_status", [
  "held",
  "partially_returned",
  "returned",
  "forfeited",
]);

export const deposits = pgTable("deposits", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  rentalId: uuid("rental_id").references(() => rentals.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  status: depositStatusEnum("status").default("held").notNull(),
  returnedAmount: numeric("returned_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDepositSchema = createInsertSchema(deposits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof deposits.$inferSelect;
