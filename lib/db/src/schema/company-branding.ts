import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const companyBranding = pgTable("company_branding", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }).unique(),
  logoUrl: text("logo_url"),
  coverImageUrl: text("cover_image_url"),
  primaryColor: varchar("primary_color", { length: 20 }),
  secondaryColor: varchar("secondary_color", { length: 20 }),
  publicTitle: varchar("public_title", { length: 255 }),
  publicDescription: text("public_description"),
  publicPhone: varchar("public_phone", { length: 50 }),
  publicEmail: varchar("public_email", { length: 255 }),
  publicCity: varchar("public_city", { length: 100 }),
  publicAddress: text("public_address"),
  websiteUrl: text("website_url"),
  socialLinks: jsonb("social_links"),
  publicEnabled: boolean("public_enabled").default(false).notNull(),
  publicShowAssets: boolean("public_show_assets").default(false).notNull(),
  publicShowPricing: boolean("public_show_pricing").default(false).notNull(),
  publicShowStations: boolean("public_show_stations").default(false).notNull(),
  publicShowB2BForm: boolean("public_show_b2b_form").default(false).notNull(),
  publicShowInquiryForm: boolean("public_show_inquiry_form").default(false).notNull(),
  publicTermsText: text("public_terms_text"),
  brandingUpdatedAt: timestamp("branding_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("company_branding_company_idx").on(t.companyId),
]);

export type CompanyBranding = typeof companyBranding.$inferSelect;
