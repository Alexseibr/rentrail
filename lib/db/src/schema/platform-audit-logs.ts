import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { companies } from "./companies";

export const platformAuditLogs = pgTable(
  "platform_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    platformRole: varchar("platform_role", { length: 50 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id"),
    targetCompanyId: uuid("target_company_id").references(() => companies.id),
    before: jsonb("before"),
    after: jsonb("after"),
    reasonCode: varchar("reason_code", { length: 100 }),
    reasonText: text("reason_text"),
    ip: varchar("ip", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("platform_audit_actor_idx").on(t.actorUserId),
    index("platform_audit_action_idx").on(t.action),
    index("platform_audit_entity_type_idx").on(t.entityType),
    index("platform_audit_target_company_idx").on(t.targetCompanyId),
    index("platform_audit_created_idx").on(t.createdAt),
  ],
);

export type PlatformAuditLog = typeof platformAuditLogs.$inferSelect;
