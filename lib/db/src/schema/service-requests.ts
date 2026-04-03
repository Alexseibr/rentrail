import { pgTable, uuid, text, timestamp, index, doublePrecision } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { assets } from "./assets";
import { clients } from "./clients";
import { users } from "./users";
import { serviceRequestTypeEnum, serviceRequestStatusEnum, servicePriorityEnum } from "./enums";

export const serviceRequests = pgTable("service_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  assetId: uuid("asset_id").references(() => assets.id),
  clientId: uuid("client_id").references(() => clients.id),
  requestType: serviceRequestTypeEnum("request_type").notNull(),
  priority: servicePriorityEnum("priority").default("medium").notNull(),
  status: serviceRequestStatusEnum("status").default("new").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  reportedByUserId: uuid("reported_by_user_id").references(() => users.id),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locationAddress: text("location_address"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("sr_company_idx").on(t.companyId),
  index("sr_branch_idx").on(t.branchId),
  index("sr_asset_idx").on(t.assetId),
  index("sr_status_idx").on(t.status),
  index("sr_assigned_idx").on(t.assignedToUserId),
  index("sr_company_branch_status_idx").on(t.companyId, t.branchId, t.status),
]);

export type ServiceRequest = typeof serviceRequests.$inferSelect;
