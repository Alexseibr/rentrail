import { pgTable, uuid, text, timestamp, numeric, integer, boolean, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { assets } from "./assets";
import { maintenanceLogTypeEnum, assetTypeEnum } from "./enums";

export const maintenanceSchedules = pgTable("maintenance_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").references(() => assets.id),
  assetType: assetTypeEnum("asset_type"),
  scheduleType: maintenanceLogTypeEnum("schedule_type").notNull(),
  name: text("name").notNull(),
  intervalKm: numeric("interval_km", { precision: 10, scale: 1 }),
  intervalDays: integer("interval_days"),
  lastDoneKm: numeric("last_done_km", { precision: 10, scale: 1 }),
  lastDoneAt: timestamp("last_done_at"),
  nextDueKm: numeric("next_due_km", { precision: 10, scale: 1 }),
  nextDueAt: timestamp("next_due_at"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("ms_company_idx").on(t.companyId),
  index("ms_asset_idx").on(t.assetId),
  index("ms_asset_type_idx").on(t.assetType),
  index("ms_next_due_at_idx").on(t.nextDueAt),
  index("ms_enabled_idx").on(t.enabled),
]);

export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type MaintenanceScheduleInsert = typeof maintenanceSchedules.$inferInsert;
