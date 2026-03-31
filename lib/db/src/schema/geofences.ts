import { pgTable, uuid, varchar, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stations } from "./stations";
import { geofenceTypeEnum } from "./enums";

export const geofences = pgTable("geofences", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  stationId: uuid("station_id").references(() => stations.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: geofenceTypeEnum("type").notNull(),
  geometry: jsonb("geometry").notNull(),
  rules: jsonb("rules"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
}, (t) => [
  index("geofences_company_idx").on(t.companyId),
  index("geofences_company_type_active_idx").on(t.companyId, t.type, t.isActive),
  index("geofences_branch_idx").on(t.branchId),
]);

export type Geofence = typeof geofences.$inferSelect;
