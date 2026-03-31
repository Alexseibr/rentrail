import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { clients } from "./clients";
import { users } from "./users";
import { blacklistScopeEnum, blacklistActionTypeEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blacklistEntries = pgTable("blacklist_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id),
  scopeType: blacklistScopeEnum("scope_type").notNull(),
  clientId: uuid("client_id").references(() => clients.id),
  fullNameSnapshot: varchar("full_name_snapshot", { length: 255 }),
  phoneSnapshot: varchar("phone_snapshot", { length: 50 }),
  emailSnapshot: varchar("email_snapshot", { length: 255 }),
  documentSnapshot: varchar("document_snapshot", { length: 100 }),
  actionType: blacklistActionTypeEnum("action_type").notNull(),
  reasonCode: varchar("reason_code", { length: 100 }).notNull(),
  reasonText: text("reason_text"),
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("bl_scope_idx").on(t.scopeType),
  index("bl_company_idx").on(t.companyId),
  index("bl_branch_idx").on(t.branchId),
  index("bl_client_idx").on(t.clientId),
  index("bl_phone_idx").on(t.phoneSnapshot),
  index("bl_document_idx").on(t.documentSnapshot),
  index("bl_scope_company_branch_idx").on(t.scopeType, t.companyId, t.branchId),
  index("bl_company_phone_idx").on(t.companyId, t.phoneSnapshot),
  index("bl_company_document_idx").on(t.companyId, t.documentSnapshot),
]);

export const insertBlacklistEntrySchema = createInsertSchema(blacklistEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBlacklistEntry = z.infer<typeof insertBlacklistEntrySchema>;
export type BlacklistEntry = typeof blacklistEntries.$inferSelect;
