import {
  pgTable,
  uuid,
  varchar,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stations } from "./stations";
import { batteryStatusEnum } from "./enums";

export const batteries = pgTable(
  "batteries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id),
    stationId: uuid("station_id").references(() => stations.id),
    serialNumber: varchar("serial_number", { length: 255 }).notNull(),
    model: varchar("model", { length: 255 }),
    capacityWh: integer("capacity_wh"),
    healthPercent: integer("health_percent"),
    cycleCount: integer("cycle_count"),
    currentChargePercent: integer("current_charge_percent"),
    currentVoltage: doublePrecision("current_voltage"),
    status: batteryStatusEnum("status").default("available").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (t) => [
    index("batteries_company_idx").on(t.companyId),
    index("batteries_company_status_idx").on(t.companyId, t.status),
    index("batteries_branch_idx").on(t.branchId),
    unique("batteries_company_serial_uniq").on(t.companyId, t.serialNumber),
  ],
);

export type Battery = typeof batteries.$inferSelect;
