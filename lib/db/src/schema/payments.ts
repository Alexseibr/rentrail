import { pgTable, uuid, varchar, jsonb, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { rentals } from "./rentals";
import { clients } from "./clients";
import { paymentStatusEnum, paymentTypeEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  clientId: uuid("client_id").references(() => clients.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  type: paymentTypeEnum("type").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  provider: varchar("provider", { length: 100 }),
  providerPaymentId: varchar("provider_payment_id", { length: 255 }),
  metadata: jsonb("metadata"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("payments_company_idx").on(t.companyId),
  index("payments_rental_idx").on(t.rentalId),
  index("payments_client_idx").on(t.clientId),
  index("payments_status_idx").on(t.status),
  index("payments_type_idx").on(t.type),
  index("payments_paid_at_idx").on(t.paidAt),
]);

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
