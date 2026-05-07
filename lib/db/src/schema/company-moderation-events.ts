import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { users } from "./users";

export const companyModerationEvents = pgTable(
  "company_moderation_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 50 }).notNull(),
    fromStatus: varchar("from_status", { length: 50 }).notNull(),
    toStatus: varchar("to_status", { length: 50 }).notNull(),
    reasonCode: varchar("reason_code", { length: 100 }).notNull(),
    reasonText: text("reason_text"),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("mod_events_company_idx").on(t.companyId),
    index("mod_events_action_idx").on(t.action),
    index("mod_events_created_idx").on(t.createdAt),
  ],
);

export type CompanyModerationEvent =
  typeof companyModerationEvents.$inferSelect;
