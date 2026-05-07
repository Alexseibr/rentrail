import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { saasInvoices } from "./saas-invoices";

export const saasPayments = pgTable(
  "saas_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => saasInvoices.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 10 }).default("USD").notNull(),
    method: varchar("method", { length: 50 }).notNull(),
    reference: varchar("reference", { length: 255 }),
    paidAt: timestamp("paid_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("saas_pay_invoice_idx").on(t.invoiceId),
    index("saas_pay_company_idx").on(t.companyId),
  ],
);

export type SaasPayment = typeof saasPayments.$inferSelect;
