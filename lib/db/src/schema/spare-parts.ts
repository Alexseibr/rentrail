import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { sparePartCategoryEnum } from "./enums";

export const spareParts = pgTable(
  "spare_parts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id),
    name: varchar("name", { length: 200 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    category: sparePartCategoryEnum("category").notNull(),
    unit: varchar("unit", { length: 20 }).default("шт").notNull(),
    qtyInStock: numeric("qty_in_stock", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    minQtyAlert: numeric("min_qty_alert", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
    location: text("location"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("sp_company_idx").on(t.companyId),
    index("sp_branch_idx").on(t.branchId),
    index("sp_category_idx").on(t.category),
    unique("sp_company_sku_uniq").on(t.companyId, t.sku),
  ],
);

export type SparePart = typeof spareParts.$inferSelect;
export type SparePartInsert = typeof spareParts.$inferInsert;
