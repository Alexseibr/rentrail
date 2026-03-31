import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { saasPlans } from "./saas-plans";
import { saasSubscriptionStatusEnum } from "./enums";

export const saasSubscriptions = pgTable("saas_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => saasPlans.id),
  status: saasSubscriptionStatusEnum("status").default("trial").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialEndsAt: timestamp("trial_ends_at"),
  canceledAt: timestamp("canceled_at"),
  cancelReason: text("cancel_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("saas_sub_company_idx").on(t.companyId),
  index("saas_sub_plan_idx").on(t.planId),
  index("saas_sub_status_idx").on(t.status),
]);

export type SaasSubscription = typeof saasSubscriptions.$inferSelect;
