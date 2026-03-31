import { pgTable, uuid, timestamp, index, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { companies } from "./companies";
import { branches } from "./branches";
import { roles } from "./roles";
import { membershipStatusEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userBranchMemberships = pgTable("user_branch_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  status: membershipStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("ubm_user_idx").on(t.userId),
  index("ubm_company_idx").on(t.companyId),
  index("ubm_branch_idx").on(t.branchId),
  index("ubm_user_company_idx").on(t.userId, t.companyId),
  unique("ubm_user_branch_role_uniq").on(t.userId, t.branchId, t.roleId),
]);

export const insertUserBranchMembershipSchema = createInsertSchema(userBranchMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserBranchMembership = z.infer<typeof insertUserBranchMembershipSchema>;
export type UserBranchMembership = typeof userBranchMemberships.$inferSelect;
