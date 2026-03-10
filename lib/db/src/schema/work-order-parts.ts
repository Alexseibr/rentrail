import {
  pgTable,
  uuid,
  timestamp,
  numeric,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { workOrders } from "./work-orders";
import { spareParts } from "./spare-parts";

export const workOrderParts = pgTable(
  "work_order_parts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    partId: uuid("part_id")
      .notNull()
      .references(() => spareParts.id),
    qtyUsed: numeric("qty_used", { precision: 10, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("wop_work_order_idx").on(t.workOrderId),
    index("wop_part_idx").on(t.partId),
    unique("wop_work_order_part_uniq").on(t.workOrderId, t.partId),
  ],
);

export type WorkOrderPart = typeof workOrderParts.$inferSelect;
export type WorkOrderPartInsert = typeof workOrderParts.$inferInsert;
