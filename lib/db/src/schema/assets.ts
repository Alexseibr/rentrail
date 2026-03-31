import { pgTable, uuid, varchar, text, boolean, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stations } from "./stations";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assetTypeEnum = pgEnum("asset_type", [
  "bike",
  "ebike",
  "scooter",
  "escooter",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "draft",
  "available",
  "reserved",
  "awaiting_pickup",
  "rented",
  "overdue",
  "charging",
  "maintenance",
  "blocked",
  "lost",
  "stolen",
  "retired",
]);

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
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
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;
