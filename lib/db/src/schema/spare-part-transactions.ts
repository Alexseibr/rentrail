import { pgTable, uuid, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { spareParts } from "./spare-parts";
import { workOrders } from "./work-orders";
import { users } from "./users";
import { sparePartTransactionTypeEnum } from "./enums";

export const sparePartTransactions = pgTable("spare_part_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  partId: uuid("part_id").notNull().references(() => spareParts.id),
  workOrderId: uuid("work_order_id").references(() => workOrders.id),
  transactionType: sparePartTransactionTypeEnum("transaction_type").notNull(),
  qty: numeric("qty", { precision: 10, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  performedByUserId: uuid("performed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("spt_company_idx").on(t.companyId),
  index("spt_part_idx").on(t.partId),
  index("spt_work_order_idx").on(t.workOrderId),
  index("spt_type_idx").on(t.transactionType),
  index("spt_created_at_idx").on(t.createdAt),
]);

export type SparePartTransaction = typeof sparePartTransactions.$inferSelect;
export type SparePartTransactionInsert = typeof sparePartTransactions.$inferInsert;
