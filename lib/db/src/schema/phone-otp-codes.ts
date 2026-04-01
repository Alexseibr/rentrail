import { pgTable, uuid, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";

export const phoneOtpCodes = pgTable("phone_otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: varchar("phone", { length: 50 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  attempts: integer("attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("otp_phone_idx").on(t.phone),
  index("otp_expires_idx").on(t.expiresAt),
]);

export type PhoneOtpCode = typeof phoneOtpCodes.$inferSelect;
