import {
  pgTable,
  uuid,
  doublePrecision,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { assets } from "./assets";
import { devices } from "./devices";

export const locationHistory = pgTable(
  "location_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id),
    deviceId: uuid("device_id").references(() => devices.id),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    speed: doublePrecision("speed"),
    heading: doublePrecision("heading"),
    recordedAt: timestamp("recorded_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("lochist_company_asset_recorded_idx").on(
      t.companyId,
      t.assetId,
      t.recordedAt,
    ),
    index("lochist_company_device_recorded_idx").on(
      t.companyId,
      t.deviceId,
      t.recordedAt,
    ),
    index("lochist_recorded_idx").on(t.recordedAt),
  ],
);

export type LocationHistory = typeof locationHistory.$inferSelect;
