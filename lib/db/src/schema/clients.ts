import { pgTable, uuid, varchar, text, timestamp, date, integer, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { clientStatusEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  birthday: date("birthday"),
  documentType: varchar("document_type", { length: 50 }),
  documentNumber: varchar("document_number", { length: 100 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  notes: text("notes"),
  status: clientStatusEnum("status").default("active").notNull(),
  rating: integer("rating").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
}, (t) => [
  index("clients_company_idx").on(t.companyId),
  index("clients_phone_idx").on(t.phone),
  index("clients_document_idx").on(t.documentNumber),
  index("clients_status_idx").on(t.status),
  unique("clients_company_phone_uniq").on(t.companyId, t.phone),
  unique("clients_company_doc_uniq").on(t.companyId, t.documentNumber),
]);

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
