import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { users } from "./users";
import { notificationTypeEnum } from "./enums";

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  data: jsonb("data"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("notifications_user_idx").on(t.userId),
  index("notifications_company_idx").on(t.companyId),
  index("notifications_user_read_idx").on(t.userId, t.readAt),
  index("notifications_created_idx").on(t.createdAt),
]);

export type Notification = typeof notifications.$inferSelect;
