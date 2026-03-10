import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { saasSubscriptions } from "./saas-subscriptions";
import { saasInvoiceStatusEnum } from "./enums";

export const saasInvoices = pgTable(
  "saas_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriptionId: uuid("subscription_id").references(
      () => saasSubscriptions.id,
    ),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 10 }).default("USD").notNull(),
    status: saasInvoiceStatusEnum("status").default("draft").notNull(),
    issuedAt: timestamp("issued_at"),
    dueDate: timestamp("due_date"),
    paidAt: timestamp("paid_at"),
    voidedAt: timestamp("voided_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("saas_inv_company_idx").on(t.companyId),
    index("saas_inv_subscription_idx").on(t.subscriptionId),
    index("saas_inv_status_idx").on(t.status),
  ],
);

export type SaasInvoice = typeof saasInvoices.$inferSelect;
