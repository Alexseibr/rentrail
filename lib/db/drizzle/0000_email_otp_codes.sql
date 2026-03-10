CREATE TYPE "public"."asset_status" AS ENUM('draft', 'available', 'reserved', 'awaiting_pickup', 'rented', 'overdue', 'charging', 'maintenance', 'blocked', 'lost', 'stolen', 'retired');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('bike', 'ebike', 'scooter', 'escooter');--> statement-breakpoint
CREATE TYPE "public"."b2b_request_status" AS ENUM('new', 'in_review', 'contacted', 'negotiating', 'converted', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."battery_assignment_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."battery_event_type" AS ENUM('installed', 'removed', 'charging_started', 'charging_stopped', 'low_battery', 'health_drop', 'disconnected', 'connected', 'other');--> statement-breakpoint
CREATE TYPE "public"."battery_status" AS ENUM('available', 'installed', 'charging', 'service', 'retired');--> statement-breakpoint
CREATE TYPE "public"."binding_status" AS ENUM('active', 'removed', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."binding_type" AS ENUM('tracker', 'lock', 'battery_bms', 'controller', 'gateway', 'other');--> statement-breakpoint
CREATE TYPE "public"."blacklist_action_type" AS ENUM('warning', 'manual_approval_only', 'increased_deposit', 'restricted_access', 'blocked_branch', 'blocked_company', 'blocked_global');--> statement-breakpoint
CREATE TYPE "public"."blacklist_scope" AS ENUM('branch', 'company', 'global');--> statement-breakpoint
CREATE TYPE "public"."branch_status" AS ENUM('active', 'inactive', 'closed');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'suspended', 'blocked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."command_status" AS ENUM('queued', 'sent', 'acknowledged', 'failed', 'expired', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."command_type" AS ENUM('lock', 'unlock', 'arm_alarm', 'disarm_alarm', 'locate', 'ping', 'disable', 'set_speed_limit');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('pending', 'trial', 'active', 'past_due', 'suspended', 'blocked', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('held', 'partially_released', 'released', 'forfeited');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('draft', 'active', 'inactive', 'offline', 'maintenance', 'blocked', 'retired');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('gps_tracker', 'smart_lock', 'battery_bms', 'controller', 'iot_gateway', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."geofence_type" AS ENUM('operating_zone', 'no_ride_zone', 'return_zone', 'service_zone', 'charging_zone');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'in_review', 'contacted', 'converted', 'rejected', 'spam', 'archived');--> statement-breakpoint
CREATE TYPE "public"."maintenance_log_type" AS ENUM('oil_change', 'tire_replacement', 'brake_service', 'battery_replacement', 'chain_service', 'electrical_repair', 'frame_repair', 'general_service', 'inspection', 'cleaning', 'other');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('inquiry_created', 'inquiry_assigned', 'inquiry_converted', 'b2b_request_created', 'b2b_request_assigned', 'payment_created', 'payment_paid', 'rental_started', 'rental_ended', 'rental_overdue', 'incident_created', 'maintenance_created', 'geofence_enter', 'geofence_exit', 'speed_limit_exceeded', 'rental_payment_held', 'rental_payment_captured', 'rental_payment_voided');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded', 'chargeback', 'voided');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('rental_payment', 'deposit_hold', 'deposit_release', 'fine', 'refund', 'adjustment', 'manual_charge');--> statement-breakpoint
CREATE TYPE "public"."rental_status" AS ENUM('draft', 'pending_approval', 'awaiting_payment', 'awaiting_pickup', 'active', 'extended', 'overdue', 'return_requested', 'completed', 'canceled', 'disputed', 'defaulted');--> statement-breakpoint
CREATE TYPE "public"."rental_type" AS ENUM('hourly', 'daily', 'weekly', 'monthly', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."saas_billing_interval" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."saas_invoice_status" AS ENUM('draft', 'issued', 'paid', 'void', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."saas_subscription_status" AS ENUM('trial', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."service_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."service_request_status" AS ENUM('new', 'assigned', 'in_progress', 'on_hold', 'completed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."service_request_type" AS ENUM('breakdown', 'flat_tire', 'brake_issue', 'battery_issue', 'electrical', 'body_damage', 'scheduled_maintenance', 'inspection', 'cleaning', 'other');--> statement-breakpoint
CREATE TYPE "public"."spare_part_category" AS ENUM('tires', 'brakes', 'electrical', 'battery', 'frame', 'chain', 'cables', 'bearings', 'accessories', 'other');--> statement-breakpoint
CREATE TYPE "public"."spare_part_transaction_type" AS ENUM('in', 'out', 'adjustment', 'write_off', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."station_status" AS ENUM('active', 'inactive', 'maintenance', 'closed');--> statement-breakpoint
CREATE TYPE "public"."station_type" AS ENUM('hub', 'pickup_point', 'service_center', 'warehouse');--> statement-breakpoint
CREATE TYPE "public"."telemetry_event_type" AS ENUM('location_update', 'online', 'offline', 'low_battery', 'charging_started', 'charging_stopped', 'lock_opened', 'lock_closed', 'alarm_armed', 'alarm_disarmed', 'geofence_enter', 'geofence_exit', 'unauthorized_movement', 'tamper_detected', 'battery_disconnected', 'battery_connected', 'ping', 'other');--> statement-breakpoint
CREATE TYPE "public"."white_label_status" AS ENUM('disabled', 'enabled', 'pending_verification');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('draft', 'assigned', 'en_route', 'in_progress', 'waiting_parts', 'completed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."work_order_type" AS ENUM('field_repair', 'workshop_repair', 'scheduled_maintenance', 'inspection', 'recovery', 'cleaning');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"country" varchar(100),
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"logo_url" text,
	"plan" varchar(50),
	"status" "company_status" DEFAULT 'pending' NOT NULL,
	"moderation_reason_code" varchar(100),
	"moderation_reason_text" text,
	"moderated_by" uuid,
	"moderated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_settings_company_key_uniq" UNIQUE("company_id","key")
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"city" varchar(100),
	"country" varchar(100),
	"timezone" varchar(100),
	"address" text,
	"phone" varchar(50),
	"email" varchar(255),
	"status" "branch_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "station_type" DEFAULT 'hub' NOT NULL,
	"address" text,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"status" "station_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"phone_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"avatar_url" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(200) NOT NULL,
	"name" varchar(255) NOT NULL,
	"module" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "user_company_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ucm_user_company_role_uniq" UNIQUE("user_id","company_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_branch_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ubm_user_branch_role_uniq" UNIQUE("user_id","branch_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip" varchar(45),
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"email" varchar(255),
	"birthday" date,
	"document_type" varchar(50),
	"document_number" varchar(100),
	"password_hash" varchar(255),
	"notes" text,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"rating" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "clients_company_phone_uniq" UNIQUE("company_id","phone"),
	CONSTRAINT "clients_company_doc_uniq" UNIQUE("company_id","document_number")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"station_id" uuid,
	"asset_type" "asset_type" NOT NULL,
	"brand" varchar(255),
	"model" varchar(255),
	"serial_number" varchar(255),
	"internal_code" varchar(100),
	"qr_code" varchar(255),
	"status" "asset_status" DEFAULT 'draft' NOT NULL,
	"purchase_price" numeric(10, 2),
	"current_value" numeric(10, 2),
	"is_public" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "assets_company_serial_uniq" UNIQUE("company_id","serial_number"),
	CONSTRAINT "assets_company_qr_uniq" UNIQUE("company_id","qr_code")
);
--> statement-breakpoint
CREATE TABLE "asset_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"from_status" "asset_status",
	"to_status" "asset_status" NOT NULL,
	"reason" text,
	"changed_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"rental_type" "rental_type" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"deposit_amount" numeric(10, 2),
	"billing_interval" varchar(50),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"station_id" uuid,
	"client_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"rental_plan_id" uuid,
	"status" "rental_status" DEFAULT 'draft' NOT NULL,
	"tariff_snapshot" jsonb,
	"deposit_amount" numeric(10, 2),
	"start_at" timestamp,
	"planned_end_at" timestamp,
	"actual_end_at" timestamp,
	"issued_by_user_id" uuid,
	"returned_to_station_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"rental_id" uuid NOT NULL,
	"from_status" "rental_status",
	"to_status" "rental_status" NOT NULL,
	"reason" text,
	"changed_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"client_id" uuid,
	"rental_id" uuid,
	"type" "payment_type" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"provider" varchar(100),
	"provider_payment_id" varchar(255),
	"metadata" jsonb,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"rental_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"status" "deposit_status" DEFAULT 'held' NOT NULL,
	"held_at" timestamp,
	"released_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blacklist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"branch_id" uuid,
	"scope_type" "blacklist_scope" NOT NULL,
	"client_id" uuid,
	"full_name_snapshot" varchar(255),
	"phone_snapshot" varchar(50),
	"email_snapshot" varchar(255),
	"document_snapshot" varchar(100),
	"action_type" "blacklist_action_type" NOT NULL,
	"reason_code" varchar(100) NOT NULL,
	"reason_text" text,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"branch_id" uuid,
	"actor_user_id" uuid,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"action" varchar(100) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"ip" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"logo_url" text,
	"cover_image_url" text,
	"primary_color" varchar(20),
	"secondary_color" varchar(20),
	"public_title" varchar(255),
	"public_description" text,
	"public_phone" varchar(50),
	"public_email" varchar(255),
	"public_city" varchar(100),
	"public_address" text,
	"website_url" text,
	"social_links" jsonb,
	"public_enabled" boolean DEFAULT false NOT NULL,
	"public_show_assets" boolean DEFAULT false NOT NULL,
	"public_show_pricing" boolean DEFAULT false NOT NULL,
	"public_show_stations" boolean DEFAULT false NOT NULL,
	"public_show_b2b_form" boolean DEFAULT false NOT NULL,
	"public_show_inquiry_form" boolean DEFAULT false NOT NULL,
	"public_terms_text" text,
	"branding_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_branding_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"station_id" uuid,
	"source" varchar(50) DEFAULT 'public_inquiry' NOT NULL,
	"status" "inquiry_status" DEFAULT 'new' NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"email" varchar(255),
	"asset_type" varchar(50),
	"preferred_asset_id" uuid,
	"requested_start_at" timestamp,
	"requested_end_at" timestamp,
	"message" text,
	"blacklist_check_result" jsonb,
	"processed_by_user_id" uuid,
	"converted_client_id" uuid,
	"converted_rental_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "b2b_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source" varchar(50) DEFAULT 'public_b2b' NOT NULL,
	"status" "b2b_request_status" DEFAULT 'new' NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"contact_person" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"email" varchar(255),
	"city" varchar(100),
	"requested_fleet_size" integer,
	"asset_types" jsonb,
	"message" text,
	"assigned_to_user_id" uuid,
	"processed_by_user_id" uuid,
	"notes_internal" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"branch_id" uuid,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"data" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"module_code" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"enabled_at" timestamp,
	"disabled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_modules_company_code_uniq" UNIQUE("company_id","module_code")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"station_id" uuid,
	"device_type" "device_type" NOT NULL,
	"provider" varchar(100) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"serial_number" varchar(255),
	"imei" varchar(20),
	"sim_number" varchar(50),
	"firmware_version" varchar(100),
	"status" "device_status" DEFAULT 'draft' NOT NULL,
	"capabilities" jsonb,
	"last_seen_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "devices_company_provider_ext_uniq" UNIQUE("company_id","provider","external_id"),
	CONSTRAINT "devices_imei_uniq" UNIQUE("imei")
);
--> statement-breakpoint
CREATE TABLE "asset_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"binding_type" "binding_type" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	"status" "binding_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"asset_id" uuid,
	"device_id" uuid,
	"battery_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"speed" double precision,
	"heading" double precision,
	"battery_percent" integer,
	"battery_voltage" double precision,
	"lock_state" varchar(20),
	"alarm_state" varchar(20),
	"online_state" varchar(20),
	"odometer" double precision,
	"payload" jsonb,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"asset_id" uuid,
	"device_id" uuid,
	"battery_id" uuid,
	"event_type" "telemetry_event_type" NOT NULL,
	"severity" "event_severity" DEFAULT 'info' NOT NULL,
	"payload" jsonb,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"asset_id" uuid,
	"device_id" uuid,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"speed" double precision,
	"heading" double precision,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batteries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"station_id" uuid,
	"serial_number" varchar(255) NOT NULL,
	"model" varchar(255),
	"capacity_wh" integer,
	"health_percent" integer,
	"cycle_count" integer,
	"current_charge_percent" integer,
	"current_voltage" double precision,
	"status" "battery_status" DEFAULT 'available' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "batteries_company_serial_uniq" UNIQUE("company_id","serial_number")
);
--> statement-breakpoint
CREATE TABLE "battery_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"battery_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	"installed_by_user_id" uuid,
	"removed_by_user_id" uuid,
	"status" "battery_assignment_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"battery_id" uuid NOT NULL,
	"asset_id" uuid,
	"event_type" "battery_event_type" NOT NULL,
	"payload" jsonb,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"station_id" uuid,
	"name" varchar(255) NOT NULL,
	"type" "geofence_type" NOT NULL,
	"geometry" jsonb NOT NULL,
	"rules" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"asset_id" uuid,
	"device_id" uuid NOT NULL,
	"command_type" "command_type" NOT NULL,
	"payload" jsonb,
	"status" "command_status" DEFAULT 'queued' NOT NULL,
	"requested_by_user_id" uuid,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"acknowledged_at" timestamp,
	"failed_at" timestamp,
	"expires_at" timestamp,
	"response_payload" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer,
	"object_path" varchar(1000) NOT NULL,
	"tag" varchar(100),
	"notes" text,
	"uploaded_by" uuid,
	"captured_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid,
	"token" varchar(500) NOT NULL,
	"platform" varchar(20) NOT NULL,
	"app_version" varchar(50),
	"device_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_uniq" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "phone_otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(50) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "platform_user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform_role_id" uuid NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"platform_role" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"target_company_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason_code" varchar(100),
	"reason_text" text,
	"ip" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"from_status" varchar(50) NOT NULL,
	"to_status" varchar(50) NOT NULL,
	"reason_code" varchar(100) NOT NULL,
	"reason_text" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"billing_interval" "saas_billing_interval" DEFAULT 'monthly' NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"white_label_available" boolean DEFAULT false NOT NULL,
	"support_tier" varchar(50) DEFAULT 'standard' NOT NULL,
	"max_branches" integer DEFAULT -1 NOT NULL,
	"max_stations" integer DEFAULT -1 NOT NULL,
	"max_assets" integer DEFAULT -1 NOT NULL,
	"max_users" integer DEFAULT -1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saas_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "saas_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "saas_subscription_status" DEFAULT 'trial' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_ends_at" timestamp,
	"canceled_at" timestamp,
	"cancel_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"company_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"status" "saas_invoice_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp,
	"due_date" timestamp,
	"paid_at" timestamp,
	"voided_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"method" varchar(50) NOT NULL,
	"reference" varchar(255),
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_white_label_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"custom_domain" varchar(255),
	"brand_name_override" varchar(255),
	"logo_url" text,
	"cover_url" text,
	"primary_color" varchar(20),
	"secondary_color" varchar(20),
	"custom_support_email" varchar(255),
	"custom_support_phone" varchar(50),
	"status" "white_label_status" DEFAULT 'disabled' NOT NULL,
	"enabled_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_white_label_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"asset_id" uuid,
	"client_id" uuid,
	"request_type" "service_request_type" NOT NULL,
	"priority" "service_priority" DEFAULT 'medium' NOT NULL,
	"status" "service_request_status" DEFAULT 'new' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"reported_by_user_id" uuid,
	"assigned_to_user_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"location_address" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"service_request_id" uuid,
	"asset_id" uuid,
	"order_type" "work_order_type" NOT NULL,
	"priority" "service_priority" DEFAULT 'medium' NOT NULL,
	"status" "work_order_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assigned_to_user_id" uuid,
	"created_by_user_id" uuid,
	"estimated_cost" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"parts_used" text,
	"resolution" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"asset_id" uuid NOT NULL,
	"work_order_id" uuid,
	"log_type" "maintenance_log_type" NOT NULL,
	"performed_at" timestamp NOT NULL,
	"performed_by_user_id" uuid,
	"odometer_km" numeric(10, 1),
	"cost" numeric(10, 2),
	"parts_used" text,
	"notes" text,
	"next_service_km" numeric(10, 1),
	"next_service_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"asset_id" uuid,
	"asset_type" "asset_type",
	"schedule_type" "maintenance_log_type" NOT NULL,
	"name" text NOT NULL,
	"interval_km" numeric(10, 1),
	"interval_days" integer,
	"last_done_km" numeric(10, 1),
	"last_done_at" timestamp,
	"next_due_km" numeric(10, 1),
	"next_due_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spare_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(200) NOT NULL,
	"sku" varchar(100),
	"category" "spare_part_category" NOT NULL,
	"unit" varchar(20) DEFAULT 'шт' NOT NULL,
	"qty_in_stock" numeric(10, 2) DEFAULT '0' NOT NULL,
	"min_qty_alert" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cost_price" numeric(10, 2),
	"location" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sp_company_sku_uniq" UNIQUE("company_id","sku")
);
--> statement-breakpoint
CREATE TABLE "spare_part_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"work_order_id" uuid,
	"transaction_type" "spare_part_transaction_type" NOT NULL,
	"qty" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 2),
	"notes" text,
	"performed_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"qty_used" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wop_work_order_part_uniq" UNIQUE("work_order_id","part_id")
);
--> statement-breakpoint
CREATE TABLE "client_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"token" varchar(500) NOT NULL,
	"title" varchar(100),
	"is_default" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rental_blackout_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"asset_id" uuid,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"severity" "incident_severity" DEFAULT 'medium' NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"reported_by_user_id" uuid,
	"assigned_to_user_id" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_memberships" ADD CONSTRAINT "user_branch_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_memberships" ADD CONSTRAINT "user_branch_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_memberships" ADD CONSTRAINT "user_branch_memberships_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_memberships" ADD CONSTRAINT "user_branch_memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_status_history" ADD CONSTRAINT "asset_status_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_status_history" ADD CONSTRAINT "asset_status_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_status_history" ADD CONSTRAINT "asset_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_plans" ADD CONSTRAINT "rental_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_rental_plan_id_rental_plans_id_fk" FOREIGN KEY ("rental_plan_id") REFERENCES "public"."rental_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_returned_to_station_id_stations_id_fk" FOREIGN KEY ("returned_to_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_status_history" ADD CONSTRAINT "rental_status_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_status_history" ADD CONSTRAINT "rental_status_history_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_status_history" ADD CONSTRAINT "rental_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_branding" ADD CONSTRAINT "company_branding_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_preferred_asset_id_assets_id_fk" FOREIGN KEY ("preferred_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_converted_client_id_clients_id_fk" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_converted_rental_id_rentals_id_fk" FOREIGN KEY ("converted_rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2b_requests" ADD CONSTRAINT "b2b_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2b_requests" ADD CONSTRAINT "b2b_requests_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2b_requests" ADD CONSTRAINT "b2b_requests_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_devices" ADD CONSTRAINT "asset_devices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_devices" ADD CONSTRAINT "asset_devices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_devices" ADD CONSTRAINT "asset_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_snapshots" ADD CONSTRAINT "telemetry_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_snapshots" ADD CONSTRAINT "telemetry_snapshots_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_snapshots" ADD CONSTRAINT "telemetry_snapshots_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batteries" ADD CONSTRAINT "batteries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batteries" ADD CONSTRAINT "batteries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batteries" ADD CONSTRAINT "batteries_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_assignments" ADD CONSTRAINT "battery_assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_assignments" ADD CONSTRAINT "battery_assignments_battery_id_batteries_id_fk" FOREIGN KEY ("battery_id") REFERENCES "public"."batteries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_assignments" ADD CONSTRAINT "battery_assignments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_assignments" ADD CONSTRAINT "battery_assignments_installed_by_user_id_users_id_fk" FOREIGN KEY ("installed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_assignments" ADD CONSTRAINT "battery_assignments_removed_by_user_id_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_events" ADD CONSTRAINT "battery_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_events" ADD CONSTRAINT "battery_events_battery_id_batteries_id_fk" FOREIGN KEY ("battery_id") REFERENCES "public"."batteries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_events" ADD CONSTRAINT "battery_events_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_api_keys" ADD CONSTRAINT "provider_api_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_platform_role_id_platform_roles_id_fk" FOREIGN KEY ("platform_role_id") REFERENCES "public"."platform_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_target_company_id_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_moderation_events" ADD CONSTRAINT "company_moderation_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_moderation_events" ADD CONSTRAINT "company_moderation_events_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_plan_id_saas_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."saas_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_subscription_id_saas_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."saas_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_payments" ADD CONSTRAINT "saas_payments_invoice_id_saas_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."saas_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_payments" ADD CONSTRAINT "saas_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_white_label_settings" ADD CONSTRAINT "company_white_label_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_part_transactions" ADD CONSTRAINT "spare_part_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_part_transactions" ADD CONSTRAINT "spare_part_transactions_part_id_spare_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_part_transactions" ADD CONSTRAINT "spare_part_transactions_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_part_transactions" ADD CONSTRAINT "spare_part_transactions_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_part_id_spare_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_methods" ADD CONSTRAINT "client_payment_methods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_methods" ADD CONSTRAINT "client_payment_methods_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_blackout_dates" ADD CONSTRAINT "rental_blackout_dates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_blackout_dates" ADD CONSTRAINT "rental_blackout_dates_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_blackout_dates" ADD CONSTRAINT "rental_blackout_dates_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_blackout_dates" ADD CONSTRAINT "rental_blackout_dates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_slug_idx" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "company_settings_company_idx" ON "company_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "branches_company_idx" ON "branches" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "branches_status_idx" ON "branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stations_company_idx" ON "stations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stations_branch_idx" ON "stations" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "stations_company_branch_idx" ON "stations" USING btree ("company_id","branch_id");--> statement-breakpoint
CREATE INDEX "stations_status_idx" ON "stations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "ucm_user_idx" ON "user_company_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ucm_company_idx" ON "user_company_memberships" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ucm_user_company_idx" ON "user_company_memberships" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE INDEX "ubm_user_idx" ON "user_branch_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ubm_company_idx" ON "user_branch_memberships" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ubm_branch_idx" ON "user_branch_memberships" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "ubm_user_company_idx" ON "user_branch_memberships" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "clients_company_idx" ON "clients" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "clients_phone_idx" ON "clients" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "clients_document_idx" ON "clients" USING btree ("document_number");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assets_company_idx" ON "assets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "assets_branch_idx" ON "assets" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "assets_station_idx" ON "assets" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assets_type_idx" ON "assets" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "assets_serial_idx" ON "assets" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "assets_qr_idx" ON "assets" USING btree ("qr_code");--> statement-breakpoint
CREATE INDEX "assets_company_branch_status_idx" ON "assets" USING btree ("company_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "ash_asset_idx" ON "asset_status_history" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "ash_company_idx" ON "asset_status_history" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ash_created_idx" ON "asset_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rental_plans_company_idx" ON "rental_plans" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "rental_plans_type_idx" ON "rental_plans" USING btree ("rental_type");--> statement-breakpoint
CREATE INDEX "rentals_company_idx" ON "rentals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "rentals_branch_idx" ON "rentals" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rentals_client_idx" ON "rentals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "rentals_asset_idx" ON "rentals" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "rentals_status_idx" ON "rentals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rentals_start_idx" ON "rentals" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "rentals_planned_end_idx" ON "rentals" USING btree ("planned_end_at");--> statement-breakpoint
CREATE INDEX "rentals_company_status_idx" ON "rentals" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "rentals_company_client_status_idx" ON "rentals" USING btree ("company_id","client_id","status");--> statement-breakpoint
CREATE INDEX "rentals_company_asset_status_idx" ON "rentals" USING btree ("company_id","asset_id","status");--> statement-breakpoint
CREATE INDEX "rsh_rental_idx" ON "rental_status_history" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "rsh_company_idx" ON "rental_status_history" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "rsh_created_idx" ON "rental_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_company_idx" ON "payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "payments_rental_idx" ON "payments" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "payments_client_idx" ON "payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_type_idx" ON "payments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "deposits_company_idx" ON "deposits" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "deposits_client_idx" ON "deposits" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "deposits_rental_idx" ON "deposits" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "deposits_status_idx" ON "deposits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bl_scope_idx" ON "blacklist_entries" USING btree ("scope_type");--> statement-breakpoint
CREATE INDEX "bl_company_idx" ON "blacklist_entries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bl_branch_idx" ON "blacklist_entries" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "bl_client_idx" ON "blacklist_entries" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bl_phone_idx" ON "blacklist_entries" USING btree ("phone_snapshot");--> statement-breakpoint
CREATE INDEX "bl_document_idx" ON "blacklist_entries" USING btree ("document_snapshot");--> statement-breakpoint
CREATE INDEX "bl_scope_company_branch_idx" ON "blacklist_entries" USING btree ("scope_type","company_id","branch_id");--> statement-breakpoint
CREATE INDEX "bl_company_phone_idx" ON "blacklist_entries" USING btree ("company_id","phone_snapshot");--> statement-breakpoint
CREATE INDEX "bl_company_document_idx" ON "blacklist_entries" USING btree ("company_id","document_snapshot");--> statement-breakpoint
CREATE INDEX "audit_company_idx" ON "audit_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_entity_id_idx" ON "audit_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "company_branding_company_idx" ON "company_branding" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "inquiries_company_idx" ON "inquiries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "inquiries_status_idx" ON "inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inquiries_company_status_idx" ON "inquiries" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "inquiries_phone_idx" ON "inquiries" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "inquiries_created_idx" ON "inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "b2b_requests_company_idx" ON "b2b_requests" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "b2b_requests_status_idx" ON "b2b_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "b2b_requests_company_status_idx" ON "b2b_requests" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "b2b_requests_created_idx" ON "b2b_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_company_idx" ON "notifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "company_modules_company_idx" ON "company_modules" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "devices_company_idx" ON "devices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "devices_company_status_idx" ON "devices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "devices_company_type_idx" ON "devices" USING btree ("company_id","device_type");--> statement-breakpoint
CREATE INDEX "devices_branch_idx" ON "devices" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "asset_devices_company_asset_status_idx" ON "asset_devices" USING btree ("company_id","asset_id","status");--> statement-breakpoint
CREATE INDEX "asset_devices_company_device_status_idx" ON "asset_devices" USING btree ("company_id","device_id","status");--> statement-breakpoint
CREATE INDEX "asset_devices_asset_idx" ON "asset_devices" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_devices_device_idx" ON "asset_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "tsnap_company_device_recorded_idx" ON "telemetry_snapshots" USING btree ("company_id","device_id","recorded_at");--> statement-breakpoint
CREATE INDEX "tsnap_company_asset_recorded_idx" ON "telemetry_snapshots" USING btree ("company_id","asset_id","recorded_at");--> statement-breakpoint
CREATE INDEX "tsnap_device_recorded_idx" ON "telemetry_snapshots" USING btree ("device_id","recorded_at");--> statement-breakpoint
CREATE INDEX "tsnap_asset_recorded_idx" ON "telemetry_snapshots" USING btree ("asset_id","recorded_at");--> statement-breakpoint
CREATE INDEX "tevt_company_asset_recorded_idx" ON "telemetry_events" USING btree ("company_id","asset_id","recorded_at");--> statement-breakpoint
CREATE INDEX "tevt_company_device_recorded_idx" ON "telemetry_events" USING btree ("company_id","device_id","recorded_at");--> statement-breakpoint
CREATE INDEX "tevt_type_severity_idx" ON "telemetry_events" USING btree ("event_type","severity");--> statement-breakpoint
CREATE INDEX "tevt_recorded_idx" ON "telemetry_events" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "lochist_company_asset_recorded_idx" ON "location_history" USING btree ("company_id","asset_id","recorded_at");--> statement-breakpoint
CREATE INDEX "lochist_company_device_recorded_idx" ON "location_history" USING btree ("company_id","device_id","recorded_at");--> statement-breakpoint
CREATE INDEX "lochist_recorded_idx" ON "location_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "batteries_company_idx" ON "batteries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "batteries_company_status_idx" ON "batteries" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "batteries_branch_idx" ON "batteries" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "batassign_battery_status_idx" ON "battery_assignments" USING btree ("battery_id","status");--> statement-breakpoint
CREATE INDEX "batassign_asset_status_idx" ON "battery_assignments" USING btree ("asset_id","status");--> statement-breakpoint
CREATE INDEX "batassign_company_idx" ON "battery_assignments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "batevt_company_battery_recorded_idx" ON "battery_events" USING btree ("company_id","battery_id","recorded_at");--> statement-breakpoint
CREATE INDEX "batevt_battery_idx" ON "battery_events" USING btree ("battery_id");--> statement-breakpoint
CREATE INDEX "geofences_company_idx" ON "geofences" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "geofences_company_type_active_idx" ON "geofences" USING btree ("company_id","type","is_active");--> statement-breakpoint
CREATE INDEX "geofences_branch_idx" ON "geofences" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "devcmd_company_device_status_idx" ON "device_commands" USING btree ("company_id","device_id","status");--> statement-breakpoint
CREATE INDEX "devcmd_status_expires_idx" ON "device_commands" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "devcmd_device_idx" ON "device_commands" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "pak_company_idx" ON "provider_api_keys" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "pak_key_hash_idx" ON "provider_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "pak_active_idx" ON "provider_api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "attachments_company_idx" ON "attachments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attachments_uploaded_by_idx" ON "attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_tokens_company_idx" ON "push_device_tokens" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "phone_otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "otp_expires_idx" ON "phone_otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "email_otp_email_idx" ON "email_otp_codes" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_otp_expires_idx" ON "email_otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "platform_roles_code_idx" ON "platform_roles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "platform_user_roles_user_idx" ON "platform_user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "platform_user_roles_role_idx" ON "platform_user_roles" USING btree ("platform_role_id");--> statement-breakpoint
CREATE INDEX "platform_user_roles_active_idx" ON "platform_user_roles" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "platform_audit_actor_idx" ON "platform_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "platform_audit_action_idx" ON "platform_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "platform_audit_entity_type_idx" ON "platform_audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "platform_audit_target_company_idx" ON "platform_audit_logs" USING btree ("target_company_id");--> statement-breakpoint
CREATE INDEX "platform_audit_created_idx" ON "platform_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mod_events_company_idx" ON "company_moderation_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "mod_events_action_idx" ON "company_moderation_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "mod_events_created_idx" ON "company_moderation_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "saas_plans_code_idx" ON "saas_plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "saas_plans_active_idx" ON "saas_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "saas_sub_company_idx" ON "saas_subscriptions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "saas_sub_plan_idx" ON "saas_subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "saas_sub_status_idx" ON "saas_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saas_inv_company_idx" ON "saas_invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "saas_inv_subscription_idx" ON "saas_invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "saas_inv_status_idx" ON "saas_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saas_pay_invoice_idx" ON "saas_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "saas_pay_company_idx" ON "saas_payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "wl_company_idx" ON "company_white_label_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "wl_status_idx" ON "company_white_label_settings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sr_company_idx" ON "service_requests" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sr_branch_idx" ON "service_requests" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "sr_asset_idx" ON "service_requests" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "sr_status_idx" ON "service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sr_assigned_idx" ON "service_requests" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "sr_company_branch_status_idx" ON "service_requests" USING btree ("company_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "wo_company_idx" ON "work_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "wo_branch_idx" ON "work_orders" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "wo_asset_idx" ON "work_orders" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "wo_status_idx" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wo_assigned_idx" ON "work_orders" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "wo_service_request_idx" ON "work_orders" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "wo_company_branch_status_idx" ON "work_orders" USING btree ("company_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "ml_company_idx" ON "maintenance_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ml_asset_idx" ON "maintenance_logs" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "ml_work_order_idx" ON "maintenance_logs" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "ml_performed_at_idx" ON "maintenance_logs" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "ml_log_type_idx" ON "maintenance_logs" USING btree ("log_type");--> statement-breakpoint
CREATE INDEX "ms_company_idx" ON "maintenance_schedules" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ms_asset_idx" ON "maintenance_schedules" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "ms_asset_type_idx" ON "maintenance_schedules" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "ms_next_due_at_idx" ON "maintenance_schedules" USING btree ("next_due_at");--> statement-breakpoint
CREATE INDEX "ms_enabled_idx" ON "maintenance_schedules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "sp_company_idx" ON "spare_parts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sp_branch_idx" ON "spare_parts" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "sp_category_idx" ON "spare_parts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "spt_company_idx" ON "spare_part_transactions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "spt_part_idx" ON "spare_part_transactions" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "spt_work_order_idx" ON "spare_part_transactions" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "spt_type_idx" ON "spare_part_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "spt_created_at_idx" ON "spare_part_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wop_work_order_idx" ON "work_order_parts" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "wop_part_idx" ON "work_order_parts" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "cpm_company_idx" ON "client_payment_methods" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cpm_client_idx" ON "client_payment_methods" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cpm_provider_idx" ON "client_payment_methods" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "blackout_company_idx" ON "rental_blackout_dates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "blackout_branch_idx" ON "rental_blackout_dates" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "blackout_asset_idx" ON "rental_blackout_dates" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "blackout_dates_idx" ON "rental_blackout_dates" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "incidents_company_idx" ON "incidents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "incidents_branch_idx" ON "incidents" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_company_status_idx" ON "incidents" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "incidents_company_branch_status_idx" ON "incidents" USING btree ("company_id","branch_id","status");