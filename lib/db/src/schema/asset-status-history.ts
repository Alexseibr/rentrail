import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { assets } from "./assets";
import { users } from "./users";
import { assetStatusEnum } from "./enums";

export const assetStatusHistory = pgTable("asset_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  fromStatus: assetStatusEnum("from_status"),
  toStatus: assetStatusEnum("to_status").notNull(),
  reason: text("reason"),
  changedByUserId: uuid("changed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("ash_asset_idx").on(t.assetId),
  index("ash_company_idx").on(t.companyId),
  index("ash_created_idx").on(t.createdAt),
]);

export type AssetStatusHistory = typeof assetStatusHistory.$inferSelect;
