import { pgTable, uuid, varchar, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { clients } from "./clients";

export const clientPaymentMethods = pgTable("client_payment_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  token: varchar("token", { length: 500 }).notNull(),
  title: varchar("title", { length: 100 }),
  isDefault: boolean("is_default").default(false).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
}, (t) => [
  index("cpm_company_idx").on(t.companyId),
  index("cpm_client_idx").on(t.clientId),
  index("cpm_provider_idx").on(t.provider),
]);

export type ClientPaymentMethod = typeof clientPaymentMethods.$inferSelect;
