import { pgTable, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { batteries } from "./batteries";
import { assets } from "./assets";
import { batteryEventTypeEnum } from "./enums";

export const batteryEvents = pgTable(
  "battery_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    batteryId: uuid("battery_id")
      .notNull()
      .references(() => batteries.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id),
    eventType: batteryEventTypeEnum("event_type").notNull(),
    payload: jsonb("payload"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("batevt_company_battery_recorded_idx").on(
      t.companyId,
      t.batteryId,
      t.recordedAt,
    ),
    index("batevt_battery_idx").on(t.batteryId),
  ],
);

export type BatteryEvent = typeof batteryEvents.$inferSelect;
