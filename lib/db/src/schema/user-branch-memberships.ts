import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { branches } from "./branches";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userBranchMemberships = pgTable("user_branch_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserBranchMembershipSchema = createInsertSchema(userBranchMemberships).omit({
  id: true,
  createdAt: true,
});
export type InsertUserBranchMembership = z.infer<typeof insertUserBranchMembershipSchema>;
export type UserBranchMembership = typeof userBranchMemberships.$inferSelect;
