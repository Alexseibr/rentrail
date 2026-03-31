import { pgEnum } from "drizzle-orm/pg-core";

export const companyStatusEnum = pgEnum("company_status", [
  "pending",
  "trial",
  "active",
  "past_due",
  "suspended",
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

export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "new",
  "in_review",
  "contacted",
  "converted",
  "rejected",
  "spam",
  "archived",
]);

export const b2bRequestStatusEnum = pgEnum("b2b_request_status", [
  "new",
  "in_review",
  "contacted",
  "negotiating",
  "converted",
  "rejected",
  "archived",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "inquiry_created",
  "inquiry_assigned",
  "inquiry_converted",
  "b2b_request_created",
  "b2b_request_assigned",
  "payment_created",
  "payment_paid",
  "rental_started",
  "rental_overdue",
  "incident_created",
  "maintenance_created",
]);

export const deviceTypeEnum = pgEnum("device_type", [
  "gps_tracker",
  "smart_lock",
  "battery_bms",
  "controller",
  "iot_gateway",
  "other",
]);

export const deviceStatusEnum = pgEnum("device_status", [
  "draft",
  "active",
  "inactive",
  "offline",
  "maintenance",
  "blocked",
  "retired",
]);

export const bindingTypeEnum = pgEnum("binding_type", [
  "tracker",
  "lock",
  "battery_bms",
  "controller",
  "gateway",
  "other",
]);

export const bindingStatusEnum = pgEnum("binding_status", [
  "active",
  "removed",
  "suspended",
]);

export const telemetryEventTypeEnum = pgEnum("telemetry_event_type", [
  "location_update",
  "online",
  "offline",
  "low_battery",
  "charging_started",
  "charging_stopped",
  "lock_opened",
  "lock_closed",
  "alarm_armed",
  "alarm_disarmed",
  "geofence_enter",
  "geofence_exit",
  "unauthorized_movement",
  "tamper_detected",
  "battery_disconnected",
  "battery_connected",
  "ping",
  "other",
]);

export const eventSeverityEnum = pgEnum("event_severity", [
  "info",
  "warning",
  "critical",
]);

export const batteryStatusEnum = pgEnum("battery_status", [
  "available",
  "installed",
  "charging",
  "service",
  "retired",
]);

export const batteryAssignmentStatusEnum = pgEnum("battery_assignment_status", [
  "active",
  "removed",
]);

export const batteryEventTypeEnum = pgEnum("battery_event_type", [
  "installed",
  "removed",
  "charging_started",
  "charging_stopped",
  "low_battery",
  "health_drop",
  "disconnected",
  "connected",
  "other",
]);

export const geofenceTypeEnum = pgEnum("geofence_type", [
  "operating_zone",
  "no_ride_zone",
  "return_zone",
  "service_zone",
  "charging_zone",
]);

export const commandTypeEnum = pgEnum("command_type", [
  "lock",
  "unlock",
  "arm_alarm",
  "disarm_alarm",
  "locate",
  "ping",
  "disable",
]);

export const commandStatusEnum = pgEnum("command_status", [
  "queued",
  "sent",
  "acknowledged",
  "failed",
  "expired",
  "canceled",
]);

export const saasBillingIntervalEnum = pgEnum("saas_billing_interval", [
  "monthly",
  "quarterly",
  "yearly",
]);

export const saasSubscriptionStatusEnum = pgEnum("saas_subscription_status", [
  "trial",
  "active",
  "past_due",
  "canceled",
]);

export const saasInvoiceStatusEnum = pgEnum("saas_invoice_status", [
  "draft",
  "issued",
  "paid",
  "void",
  "overdue",
]);

export const whiteLabelStatusEnum = pgEnum("white_label_status", [
  "disabled",
  "enabled",
  "pending_verification",
]);
