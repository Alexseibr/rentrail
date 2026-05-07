import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { assets } from "./assets";
import { devices } from "./devices";
import { bindingTypeEnum, bindingStatusEnum } from "./enums";

export const assetDevices = pgTable(
  "asset_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    bindingType: bindingTypeEnum("binding_type").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    installedAt: timestamp("installed_at").defaultNow().notNull(),
    removedAt: timestamp("removed_at"),
    status: bindingStatusEnum("status").default("active").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("asset_devices_company_asset_status_idx").on(
      t.companyId,
      t.assetId,
      t.status,
    ),
    index("asset_devices_company_device_status_idx").on(
      t.companyId,
      t.deviceId,
      t.status,
    ),
    index("asset_devices_asset_idx").on(t.assetId),
    index("asset_devices_device_idx").on(t.deviceId),
  ],
);

export type AssetDevice = typeof assetDevices.$inferSelect;
