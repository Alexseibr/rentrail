import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { users } from "./users";
import { b2bRequestStatusEnum } from "./enums";

export const b2bRequests = pgTable(
  "b2b_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 50 }).default("public_b2b").notNull(),
    status: b2bRequestStatusEnum("status").default("new").notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    contactPerson: varchar("contact_person", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }),
    city: varchar("city", { length: 100 }),
    requestedFleetSize: integer("requested_fleet_size"),
    assetTypes: jsonb("asset_types"),
    message: text("message"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    processedByUserId: uuid("processed_by_user_id").references(() => users.id),
    notesInternal: text("notes_internal"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("b2b_requests_company_idx").on(t.companyId),
    index("b2b_requests_status_idx").on(t.status),
    index("b2b_requests_company_status_idx").on(t.companyId, t.status),
    index("b2b_requests_created_idx").on(t.createdAt),
  ],
);

export type B2BRequest = typeof b2bRequests.$inferSelect;
