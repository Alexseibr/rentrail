import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { assets, assetStatusEnum } from "./assets";
import { users } from "./users";

export const assetStatusHistory = pgTable("asset_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  previousStatus: assetStatusEnum("previous_status"),
  newStatus: assetStatusEnum("new_status").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AssetStatusHistory = typeof assetStatusHistory.$inferSelect;
