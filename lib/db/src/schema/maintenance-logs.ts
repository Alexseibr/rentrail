import { pgTable, uuid, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { assets } from "./assets";
import { users } from "./users";
import { workOrders } from "./work-orders";
import { maintenanceLogTypeEnum } from "./enums";

export const maintenanceLogs = pgTable("maintenance_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  assetId: uuid("asset_id").notNull().references(() => assets.id),
  workOrderId: uuid("work_order_id").references(() => workOrders.id),
  logType: maintenanceLogTypeEnum("log_type").notNull(),
  performedAt: timestamp("performed_at").notNull(),
  performedByUserId: uuid("performed_by_user_id").references(() => users.id),
  odometerKm: numeric("odometer_km", { precision: 10, scale: 1 }),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  partsUsed: text("parts_used"),
  notes: text("notes"),
  nextServiceKm: numeric("next_service_km", { precision: 10, scale: 1 }),
  nextServiceDate: timestamp("next_service_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("ml_company_idx").on(t.companyId),
  index("ml_asset_idx").on(t.assetId),
  index("ml_work_order_idx").on(t.workOrderId),
  index("ml_performed_at_idx").on(t.performedAt),
  index("ml_log_type_idx").on(t.logType),
]);

export type MaintenanceLog = typeof maintenanceLogs.$inferSelect;
export type MaintenanceLogInsert = typeof maintenanceLogs.$inferInsert;
