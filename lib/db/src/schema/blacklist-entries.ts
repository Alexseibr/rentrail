import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { clients } from "./clients";
import { users } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blacklistLevelEnum = pgEnum("blacklist_level", [
  "branch",
  "company",
  "global",
]);

export const blacklistActionEnum = pgEnum("blacklist_action", [
  "warning",
  "manual_approval_only",
  "increased_deposit",
  "restricted_access",
  "blocked_branch",
  "blocked_company",
  "blocked_global",
]);

export const blacklistEntries = pgTable("blacklist_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  level: blacklistLevelEnum("level").notNull(),
  action: blacklistActionEnum("action").notNull(),
  reason: text("reason").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBlacklistEntrySchema = createInsertSchema(blacklistEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBlacklistEntry = z.infer<typeof insertBlacklistEntrySchema>;
export type BlacklistEntry = typeof blacklistEntries.$inferSelect;
