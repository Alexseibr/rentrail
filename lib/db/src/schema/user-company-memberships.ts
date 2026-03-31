import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { companies } from "./companies";
import { roles } from "./roles";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userCompanyMemberships = pgTable("user_company_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserCompanyMembershipSchema = createInsertSchema(userCompanyMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserCompanyMembership = z.infer<typeof insertUserCompanyMembershipSchema>;
export type UserCompanyMembership = typeof userCompanyMemberships.$inferSelect;
