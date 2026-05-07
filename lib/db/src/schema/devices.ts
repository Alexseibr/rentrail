import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stations } from "./stations";
import { deviceTypeEnum, deviceStatusEnum } from "./enums";

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id),
    stationId: uuid("station_id").references(() => stations.id),
    deviceType: deviceTypeEnum("device_type").notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    serialNumber: varchar("serial_number", { length: 255 }),
    imei: varchar("imei", { length: 20 }),
    simNumber: varchar("sim_number", { length: 50 }),
    firmwareVersion: varchar("firmware_version", { length: 100 }),
    status: deviceStatusEnum("status").default("draft").notNull(),
    capabilities: jsonb("capabilities"),
    lastSeenAt: timestamp("last_seen_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (t) => [
    index("devices_company_idx").on(t.companyId),
    index("devices_company_status_idx").on(t.companyId, t.status),
    index("devices_company_type_idx").on(t.companyId, t.deviceType),
    index("devices_branch_idx").on(t.branchId),
    unique("devices_company_provider_ext_uniq").on(
      t.companyId,
      t.provider,
      t.externalId,
    ),
    unique("devices_imei_uniq").on(t.imei),
  ],
);

export type Device = typeof devices.$inferSelect;
