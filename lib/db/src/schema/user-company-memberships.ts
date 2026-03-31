import { pgTable, uuid, timestamp, index, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { companies } from "./companies";
import { roles } from "./roles";
import { membershipStatusEnum } from "./enums";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userCompanyMemberships = pgTable("user_company_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  status: membershipStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("ucm_user_idx").on(t.userId),
  index("ucm_company_idx").on(t.companyId),
  index("ucm_user_company_idx").on(t.userId, t.companyId),
  unique("ucm_user_company_role_uniq").on(t.userId, t.companyId, t.roleId),
]);

export const insertUserCompanyMembershipSchema = createInsertSchema(userCompanyMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserCompanyMembership = z.infer<typeof insertUserCompanyMembershipSchema>;
export type UserCompanyMembership = typeof userCompanyMemberships.$inferSelect;
