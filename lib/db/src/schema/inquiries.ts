import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { branches } from "./branches";
import { stations } from "./stations";
import { assets } from "./assets";
import { clients } from "./clients";
import { rentals } from "./rentals";
import { users } from "./users";
import { inquiryStatusEnum } from "./enums";

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id),
    stationId: uuid("station_id").references(() => stations.id),
    source: varchar("source", { length: 50 })
      .default("public_inquiry")
      .notNull(),
    status: inquiryStatusEnum("status").default("new").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }),
    assetType: varchar("asset_type", { length: 50 }),
    preferredAssetId: uuid("preferred_asset_id").references(() => assets.id),
    requestedStartAt: timestamp("requested_start_at"),
    requestedEndAt: timestamp("requested_end_at"),
    message: text("message"),
    blacklistCheckResult: jsonb("blacklist_check_result"),
    processedByUserId: uuid("processed_by_user_id").references(() => users.id),
    convertedClientId: uuid("converted_client_id").references(() => clients.id),
    convertedRentalId: uuid("converted_rental_id").references(() => rentals.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("inquiries_company_idx").on(t.companyId),
    index("inquiries_status_idx").on(t.status),
    index("inquiries_company_status_idx").on(t.companyId, t.status),
    index("inquiries_phone_idx").on(t.phone),
    index("inquiries_created_idx").on(t.createdAt),
  ],
);

export type Inquiry = typeof inquiries.$inferSelect;
