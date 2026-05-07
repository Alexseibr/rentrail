import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const providerApiKeys = pgTable(
  "provider_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [
    index("pak_company_idx").on(t.companyId),
    index("pak_key_hash_idx").on(t.keyHash),
    index("pak_active_idx").on(t.isActive),
  ],
);

export type ProviderApiKey = typeof providerApiKeys.$inferSelect;
