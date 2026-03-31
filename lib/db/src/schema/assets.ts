import { pgTable, uuid, varchar, text, boolean, timestamp, numeric, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stations } from "./stations";
import { assetTypeEnum, assetStatusEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  stationId: uuid("station_id").references(() => stations.id),
  assetType: assetTypeEnum("asset_type").notNull(),
  brand: varchar("brand", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serial_number", { length: 255 }),
  internalCode: varchar("internal_code", { length: 100 }),
  qrCode: varchar("qr_code", { length: 255 }),
  status: assetStatusEnum("status").default("draft").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
  currentValue: numeric("current_value", { precision: 10, scale: 2 }),
  isPublic: boolean("is_public").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
}, (t) => [
  index("assets_company_idx").on(t.companyId),
  index("assets_branch_idx").on(t.branchId),
  index("assets_station_idx").on(t.stationId),
  index("assets_status_idx").on(t.status),
  index("assets_type_idx").on(t.assetType),
  index("assets_serial_idx").on(t.serialNumber),
  index("assets_qr_idx").on(t.qrCode),
  index("assets_company_branch_status_idx").on(t.companyId, t.branchId, t.status),
  unique("assets_company_serial_uniq").on(t.companyId, t.serialNumber),
  unique("assets_company_qr_uniq").on(t.companyId, t.qrCode),
]);

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;
