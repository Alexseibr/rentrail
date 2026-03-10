import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const platformRoles = pgTable(
  "platform_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("platform_roles_code_idx").on(t.code)],
);

export type PlatformRole = typeof platformRoles.$inferSelect;

export const platformUserRoles = pgTable(
  "platform_user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platformRoleId: uuid("platform_role_id")
      .notNull()
      .references(() => platformRoles.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => users.id),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("platform_user_roles_user_idx").on(t.userId),
    index("platform_user_roles_role_idx").on(t.platformRoleId),
    index("platform_user_roles_active_idx").on(t.userId, t.isActive),
  ],
);

export type PlatformUserRole = typeof platformUserRoles.$inferSelect;
