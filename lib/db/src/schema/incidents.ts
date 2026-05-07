import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { users } from "./users";

export const incidentSeverityEnum = pgEnum("incident_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id),
    title: text("title").notNull(),
    description: text("description"),
    severity: incidentSeverityEnum("severity").default("medium").notNull(),
    status: incidentStatusEnum("status").default("open").notNull(),
    reportedByUserId: uuid("reported_by_user_id").references(() => users.id),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("incidents_company_idx").on(t.companyId),
    index("incidents_branch_idx").on(t.branchId),
    index("incidents_status_idx").on(t.status),
    index("incidents_company_status_idx").on(t.companyId, t.status),
    index("incidents_company_branch_status_idx").on(
      t.companyId,
      t.branchId,
      t.status,
    ),
  ],
);

export type Incident = typeof incidents.$inferSelect;
