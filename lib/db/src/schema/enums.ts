import { pgEnum } from "drizzle-orm/pg-core";

export const companyStatusEnum = pgEnum("company_status", [
  "pending",
  "trial",
  "active",
  "past_due",
  "blocked",
  "canceled",
]);

export const branchStatusEnum = pgEnum("branch_status", [
  "active",
  "inactive",
  "closed",
]);

export const stationStatusEnum = pgEnum("station_status", [
  "active",
  "inactive",
  "maintenance",
  "closed",
]);

export const stationTypeEnum = pgEnum("station_type", [
  "hub",
  "pickup_point",
  "service_center",
  "warehouse",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "suspended",
  "disabled",
]);

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "suspended",
  "blocked",
  "archived",
]);

export const assetTypeEnum = pgEnum("asset_type", [
  "bike",
  "ebike",
  "scooter",
  "escooter",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "draft",
  "available",
  "reserved",
  "awaiting_pickup",
  "rented",
  "overdue",
  "charging",
  "maintenance",
  "blocked",
  "lost",
  "stolen",
  "retired",
]);

export const rentalTypeEnum = pgEnum("rental_type", [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "subscription",
]);

export const rentalStatusEnum = pgEnum("rental_status", [
  "draft",
  "pending_approval",
  "awaiting_payment",
  "awaiting_pickup",
  "active",
  "extended",
  "overdue",
  "return_requested",
  "completed",
  "canceled",
  "disputed",
  "defaulted",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
  "chargeback",
]);

export const paymentTypeEnum = pgEnum("payment_type", [
  "rental_payment",
  "deposit_hold",
  "deposit_release",
  "fine",
  "refund",
  "adjustment",
  "manual_charge",
]);

export const depositStatusEnum = pgEnum("deposit_status", [
  "held",
  "partially_released",
  "released",
  "forfeited",
]);

export const blacklistScopeEnum = pgEnum("blacklist_scope", [
  "branch",
  "company",
  "global",
]);

export const blacklistActionTypeEnum = pgEnum("blacklist_action_type", [
  "warning",
  "manual_approval_only",
  "increased_deposit",
  "restricted_access",
  "blocked_branch",
  "blocked_company",
  "blocked_global",
]);
