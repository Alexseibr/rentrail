import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { whiteLabelStatusEnum } from "./enums";

export const companyWhiteLabelSettings = pgTable("company_white_label_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }).unique(),
  customDomain: varchar("custom_domain", { length: 255 }),
  brandNameOverride: varchar("brand_name_override", { length: 255 }),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  primaryColor: varchar("primary_color", { length: 20 }),
  secondaryColor: varchar("secondary_color", { length: 20 }),
  customSupportEmail: varchar("custom_support_email", { length: 255 }),
  customSupportPhone: varchar("custom_support_phone", { length: 50 }),
  status: whiteLabelStatusEnum("status").default("disabled").notNull(),
  enabledAt: timestamp("enabled_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("wl_company_idx").on(t.companyId),
  index("wl_status_idx").on(t.status),
]);

export type CompanyWhiteLabelSettings = typeof companyWhiteLabelSettings.$inferSelect;
