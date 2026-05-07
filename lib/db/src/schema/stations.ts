import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stationStatusEnum, stationTypeEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stations = pgTable(
  "stations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: stationTypeEnum("type").default("hub").notNull(),
    address: text("address"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    status: stationStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("stations_company_idx").on(t.companyId),
    index("stations_branch_idx").on(t.branchId),
    index("stations_company_branch_idx").on(t.companyId, t.branchId),
    index("stations_status_idx").on(t.status),
  ],
);

export const insertStationSchema = createInsertSchema(stations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStation = z.infer<typeof insertStationSchema>;
export type Station = typeof stations.$inferSelect;
