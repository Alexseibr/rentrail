# Workspace — Multi-Tenant SaaS Rental Platform

## Overview

This project is a pnpm workspace monorepo designed for a multi-tenant SaaS platform specializing in renting light electric vehicles like bikes, ebikes, scooters, and escooters. Its core purpose is to provide a comprehensive management system where each company operates as an independent tenant, managing its own branches, stations, clients, assets, and rental operations. The platform aims to streamline rental processes, manage fleet operations, handle client interactions, and provide robust administrative controls, including a sophisticated role-based access control system.

The business vision is to become the leading SaaS solution for micro-mobility rental businesses, offering a scalable, secure, and feature-rich platform. It targets rapid market penetration by providing a highly customizable and efficient system that reduces operational overhead for rental companies. The project ambitions include expanding into a full-fledged connected fleet management system, integrating IoT devices for real-time telemetry, advanced battery management, and sophisticated command and control capabilities for assets.

## User Preferences

I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
I prefer simple language.
I like functional programming.

## System Architecture

The project is built as a pnpm monorepo using Node.js 24 and TypeScript 5.9. The backend API is developed with Express 5, utilizing PostgreSQL with Drizzle ORM for data persistence. Zod is used for validation, and JWT with bcrypt secures authentication. API codegen is handled by Orval from an OpenAPI spec. The build process uses esbuild.

### UI/UX Decisions
The platform includes a mobile staff application built with Expo/React Native, focusing on intuitive workflows for operators and field staff. This app uses `expo-router` for file-based routing and `@tanstack/react-query` for data fetching. Key UI/UX considerations include:
- **Navigation:** A tab-based navigation with Dashboard, Assets, Rentals, Operations, and Settings for easy access to core functionalities.
- **Modal Screens:** Dedicated modal screens for actions like QR/barcode scanning, incident/maintenance creation, and offline sync queue management.
- **Offline-First Capabilities:** The mobile app incorporates an offline queue system using AsyncStorage to persist mutations and synchronize data upon reconnection, ensuring operational continuity in low-connectivity environments.

### Technical Implementations
- **Multi-Tenancy:** Achieved by requiring an `x-company-id` header for all tenant-scoped requests and filtering all database queries by `companyId` to prevent data leakage.
- **Authentication & Authorization:**
    - JWT access (15min) and refresh tokens (7 days) with token rotation. Refresh tokens are SHA-256 hashed.
    - Password hashing with bcrypt (12 rounds).
    - Role-Based Access Control (RBAC) implemented via a permission-based system. Middleware chains (`authenticate`, `requireCompanyAccess`, `requirePermission`) validate user identity, tenant context, and specific permissions for each action, ensuring fine-grained access control without hardcoding role names in handlers. Permissions are defined at a granular `resource:action` level and grouped by modules (e.g., platform, organization, crm, fleet).
- **Database Schema:** A robust PostgreSQL schema with 26 tables and over 100 indexes, utilizing Drizzle ORM for type-safe interactions. Key entities include companies, branches, stations, users, clients, assets, rentals, payments, and audit logs. Drizzle's `relations()` are extensively used for relational queries.
- **Asset & Rental Status Machines:** Strict state machines enforce valid transitions for asset and rental statuses, logging every change to dedicated history tables. This ensures data integrity and provides an auditable trail of operational changes.
- **Lead Intake:** Public-facing inquiry and B2B request forms serve as lead intake mechanisms. These leads are processed through a status machine and can be converted into clients or rental drafts, but do not directly create active rentals.
- **Connected Fleet Foundation (IoT Integration):**
    - **Devices:** Management of various IoT devices (GPS trackers, smart locks, BMS, controllers) with their own status machines and binding to assets.
    - **Telemetry:** Append-only storage for real-time telemetry data (location, speed, battery, status), and event logging for significant occurrences.
    - **Batteries:** Inventory and lifecycle management of batteries, including assignments to assets and event tracking.
    - **Geofences:** GeoJSON-based polygonal zones for operational rules.
    - **Device Commands:** A command queuing system for remote control of devices (lock/unlock, alarm, ping).
    - **M2M Telemetry Ingest:** A secure mechanism for IoT providers to ingest telemetry data using API keys, separate from user authentication.

### Feature Specifications
- **Core Rental Management:** Create, list, retrieve, and manage rentals, including approval, start, extension, return, and cancellation workflows.
- **Client Management:** Comprehensive client profiles with personal details, status, and associated blacklist entries.
- **Asset Management:** Detailed asset tracking, including type, brand, model, serial numbers, public visibility, and operational status changes.
- **Financial Tracking:** Payments and deposits management with various statuses and types.
- **Blacklisting:** System to blacklist clients at branch, company, or global scope, with automated client data snapshots.
- **Company Configuration:** Per-company settings, branding customization, and modular feature toggles.
- **Notifications:** In-app notification system for users.
- **Audit Logging:** Detailed audit trails for critical actions, capturing before/after states and actor information.

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **API Framework:** Express 5
- **Validation:** Zod
- **Authentication:** JWT (JSON Web Tokens), bcrypt
- **API Codegen:** Orval
- **Build Tool:** esbuild
- **Mobile Development:** Expo SDK, React Native
- **Data Fetching (Mobile):** @tanstack/react-query
- **Camera/Image:** `expo-camera`, `expo-image-picker`
- **Notifications (Mobile):** `expo-notifications`
- **Haptics (Mobile):** `expo-haptics`
- **Local Storage (Mobile):** AsyncStorage
- **Object Storage:** Google Cloud Storage (GCS) (via Replit App Storage for presigned URL uploads)
- **Testing:** Vitest 4.x, supertest
- **CI:** GitHub Actions

## Testing

The project uses Vitest with a workspace configuration (`vitest.workspace.ts`) defining 4 projects: `api-unit`, `api-integration`, `api-e2e`, `mobile-unit`.

### Test Commands
- `pnpm test` — Run all 179 tests (8 suites)
- `pnpm test:unit` — Unit tests only (pure logic, no DB)
- `pnpm test:api` — API integration tests (supertest against real DB)
- `pnpm test:integration` — Integration tests (DB-backed)

### Test Utilities
- `artifacts/api-server/src/test/setup.ts` — DB cleanup helpers (`cleanDatabase` preserves roles/permissions; `cleanDatabaseFull` truncates everything)
- `artifacts/api-server/src/test/helpers.ts` — `createTestUser`, `createTestTenant`, `assignRole`, `authHeaders`, `clearRolesCache`
- `artifacts/api-server/src/test/app.ts` — Express app instance for supertest
- `artifacts/api-server/src/test/seed-rbac-inline.ts` — In-process RBAC seeder for API tests (avoids slow subprocess)

### Test File Naming
- `*.unit.test.ts` — Pure unit tests
- `*.api.test.ts` — API/E2E tests via supertest
- `*.int.test.ts` — Integration tests with DB

## Observability

- **Health endpoints:** `/api/healthz` (simple), `/api/health` (uptime), `/api/health/full` (DB latency + env info)
- **Correlation IDs:** `x-correlation-id` header injected by middleware, propagated in pino-http logs
- **Env validation:** Strict startup validation in `artifacts/api-server/src/lib/env.ts`
- **Error tracking:** Abstraction layer ready for Sentry/etc integration

## Demo Data

- `pnpm seed:demo` — Seeds 40 assets, 20 clients, 14 rentals, devices, batteries, telemetry for company `velocity-rides`
- All demo users use password `demo1234`

## CI Pipeline

- `.github/workflows/ci.yml` — Lint, typecheck, test, build stages
- `docs/release-readiness.md` — Release checklist
- `docs/qa-scenarios.md` — QA test matrix