import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { assets } from "./assets";
import { devices } from "./devices";
import { users } from "./users";
import { commandTypeEnum, commandStatusEnum } from "./enums";

export const deviceCommands = pgTable(
  "device_commands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    commandType: commandTypeEnum("command_type").notNull(),
    payload: jsonb("payload"),
    status: commandStatusEnum("status").default("queued").notNull(),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id),
    queuedAt: timestamp("queued_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    acknowledgedAt: timestamp("acknowledged_at"),
    failedAt: timestamp("failed_at"),
    expiresAt: timestamp("expires_at"),
    responsePayload: jsonb("response_payload"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("devcmd_company_device_status_idx").on(
      t.companyId,
      t.deviceId,
      t.status,
    ),
    index("devcmd_status_expires_idx").on(t.status, t.expiresAt),
    index("devcmd_device_idx").on(t.deviceId),
  ],
);

export type DeviceCommand = typeof deviceCommands.$inferSelect;
