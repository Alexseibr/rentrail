import { pgTable, uuid, varchar, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { users } from "./users";

export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size"),
  objectPath: varchar("object_path", { length: 1000 }).notNull(),
  tag: varchar("tag", { length: 100 }),
  notes: text("notes"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  capturedAt: timestamp("captured_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("attachments_company_idx").on(t.companyId),
  index("attachments_entity_idx").on(t.entityType, t.entityId),
  index("attachments_uploaded_by_idx").on(t.uploadedBy),
]);

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;
