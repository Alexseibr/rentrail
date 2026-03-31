import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { users } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id),
  branchId: uuid("branch_id"),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id"),
  action: varchar("action", { length: 100 }).notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  metadata: jsonb("metadata"),
  ip: varchar("ip", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("audit_company_idx").on(t.companyId),
  index("audit_actor_idx").on(t.actorUserId),
  index("audit_entity_type_idx").on(t.entityType),
  index("audit_entity_id_idx").on(t.entityId),
  index("audit_created_idx").on(t.createdAt),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
