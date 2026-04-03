import { pgTable, uuid, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { assets } from "./assets";
import { users } from "./users";
import { serviceRequests } from "./service-requests";
import { workOrderTypeEnum, workOrderStatusEnum, servicePriorityEnum } from "./enums";

export const workOrders = pgTable("work_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  serviceRequestId: uuid("service_request_id").references(() => serviceRequests.id),
  assetId: uuid("asset_id").references(() => assets.id),
  orderType: workOrderTypeEnum("order_type").notNull(),
  priority: servicePriorityEnum("priority").default("medium").notNull(),
  status: workOrderStatusEnum("status").default("draft").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 10, scale: 2 }),
  partsUsed: text("parts_used"),
  resolution: text("resolution"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("wo_company_idx").on(t.companyId),
  index("wo_branch_idx").on(t.branchId),
  index("wo_asset_idx").on(t.assetId),
  index("wo_status_idx").on(t.status),
  index("wo_assigned_idx").on(t.assignedToUserId),
  index("wo_service_request_idx").on(t.serviceRequestId),
  index("wo_company_branch_status_idx").on(t.companyId, t.branchId, t.status),
]);

export type WorkOrder = typeof workOrders.$inferSelect;
