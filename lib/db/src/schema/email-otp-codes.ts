import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const emailOtpCodes = pgTable(
  "email_otp_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    code: varchar("code", { length: 6 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("email_otp_email_idx").on(t.email),
    index("email_otp_expires_idx").on(t.expiresAt),
  ],
);

export type EmailOtpCode = typeof emailOtpCodes.$inferSelect;
