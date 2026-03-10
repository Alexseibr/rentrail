import { pgTable, uuid, timestamp, text, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { batteries } from "./batteries";
import { assets } from "./assets";
import { users } from "./users";
import { batteryAssignmentStatusEnum } from "./enums";

export const batteryAssignments = pgTable(
  "battery_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    batteryId: uuid("battery_id")
      .notNull()
      .references(() => batteries.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    installedAt: timestamp("installed_at").defaultNow().notNull(),
    removedAt: timestamp("removed_at"),
    installedByUserId: uuid("installed_by_user_id").references(() => users.id),
    removedByUserId: uuid("removed_by_user_id").references(() => users.id),
    status: batteryAssignmentStatusEnum("status").default("active").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("batassign_battery_status_idx").on(t.batteryId, t.status),
    index("batassign_asset_status_idx").on(t.assetId, t.status),
    index("batassign_company_idx").on(t.companyId),
  ],
);

export type BatteryAssignment = typeof batteryAssignments.$inferSelect;
