import { pgTable, uuid, varchar, timestamp, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { users } from "./users";

export const pushDeviceTokens = pgTable("push_device_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 500 }).notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  appVersion: varchar("app_version", { length: 50 }),
  deviceId: varchar("device_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("push_tokens_user_idx").on(t.userId),
  index("push_tokens_company_idx").on(t.companyId),
  unique("push_tokens_token_uniq").on(t.token),
]);

export type PushDeviceToken = typeof pushDeviceTokens.$inferSelect;
export type InsertPushDeviceToken = typeof pushDeviceTokens.$inferInsert;
