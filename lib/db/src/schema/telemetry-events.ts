import { pgTable, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { assets } from "./assets";
import { devices } from "./devices";
import { telemetryEventTypeEnum, eventSeverityEnum } from "./enums";

export const telemetryEvents = pgTable(
  "telemetry_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id),
    deviceId: uuid("device_id").references(() => devices.id),
    batteryId: uuid("battery_id"),
    eventType: telemetryEventTypeEnum("event_type").notNull(),
    severity: eventSeverityEnum("severity").default("info").notNull(),
    payload: jsonb("payload"),
    recordedAt: timestamp("recorded_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("tevt_company_asset_recorded_idx").on(
      t.companyId,
      t.assetId,
      t.recordedAt,
    ),
    index("tevt_company_device_recorded_idx").on(
      t.companyId,
      t.deviceId,
      t.recordedAt,
    ),
    index("tevt_type_severity_idx").on(t.eventType, t.severity),
    index("tevt_recorded_idx").on(t.recordedAt),
  ],
);

export type TelemetryEvent = typeof telemetryEvents.$inferSelect;
