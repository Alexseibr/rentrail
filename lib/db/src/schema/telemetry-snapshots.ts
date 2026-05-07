import {
  pgTable,
  uuid,
  doublePrecision,
  integer,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { assets } from "./assets";
import { devices } from "./devices";

export const telemetrySnapshots = pgTable(
  "telemetry_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id),
    deviceId: uuid("device_id").references(() => devices.id),
    batteryId: uuid("battery_id"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    speed: doublePrecision("speed"),
    heading: doublePrecision("heading"),
    batteryPercent: integer("battery_percent"),
    batteryVoltage: doublePrecision("battery_voltage"),
    lockState: varchar("lock_state", { length: 20 }),
    alarmState: varchar("alarm_state", { length: 20 }),
    onlineState: varchar("online_state", { length: 20 }),
    odometer: doublePrecision("odometer"),
    payload: jsonb("payload"),
    recordedAt: timestamp("recorded_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("tsnap_company_device_recorded_idx").on(
      t.companyId,
      t.deviceId,
      t.recordedAt,
    ),
    index("tsnap_company_asset_recorded_idx").on(
      t.companyId,
      t.assetId,
      t.recordedAt,
    ),
    index("tsnap_device_recorded_idx").on(t.deviceId, t.recordedAt),
    index("tsnap_asset_recorded_idx").on(t.assetId, t.recordedAt),
  ],
);

export type TelemetrySnapshot = typeof telemetrySnapshots.$inferSelect;
