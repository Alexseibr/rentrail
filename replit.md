# Workspace — Multi-Tenant SaaS Rental Platform

## Overview

This project is a pnpm monorepo for a multi-tenant SaaS platform focused on renting light electric vehicles (bikes, ebikes, scooters, escooters). It provides a comprehensive management system for companies to manage branches, stations, clients, assets, and rental operations. The platform aims to streamline rental processes, manage fleets, handle client interactions, and offer robust administrative controls including role-based access. The business vision is to become the leading SaaS solution for micro-mobility rental businesses, targeting rapid market penetration by offering a scalable, secure, and customizable platform that reduces operational overhead. Future ambitions include expanding into connected fleet management with IoT integration for real-time telemetry, advanced battery management, and remote asset control.

## User Preferences

I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
I prefer simple language.
I like functional programming.

## System Architecture

The project is a pnpm monorepo using Node.js 24 and TypeScript 5.9. The backend API is built with Express 5, utilizing PostgreSQL with Drizzle ORM, Zod for validation, and JWT with bcrypt for authentication. API codegen is handled by Orval from an OpenAPI spec, and esbuild is used for the build process.

### UI/UX Decisions
A mobile staff application, built with Expo/React Native, provides intuitive workflows for operators. It features tab-based navigation, modal screens for specific actions (e.g., QR scanning, incident creation), offline-first capabilities with an AsyncStorage queue for data synchronization, and full bilingual i18n support (Russian default, English) using i18next + react-i18next with language persisted in AsyncStorage. Language toggle available in Settings screen.

A platform admin web UI, built with React + Vite + shadcn/UI, provides SaaS owners with management capabilities. It uses a **Yandex Go-inspired design system**: dark sidebar (navy, hsl 220/20%/14%), amber/yellow primary accent (hsl 45/96%/53%), light gray background (hsl 0/0%/97%), rounded-2xl cards with shadow (no borders), rounded-xl buttons/inputs, pill-shaped badges, branded login page with gradient background. Responsive layout with collapsible sidebar on desktop and bottom tab bar on mobile. Page transitions via CSS animation. It features:
- **Auth:** JWT-based login with automatic token refresh, stored in-memory with localStorage persistence
- **Dashboard:** Overview metrics from analytics and health endpoints
- **Companies:** List/detail views with search, filtering, pagination, moderation actions (approve/block/suspend/unblock/cancel), usage and health tabs
- **Billing:** Plans management (CRUD), subscriptions list with status filtering, invoices with mark-paid capability
- **Global Blacklist:** CRUD with identity-based entries (name/email/phone/document), enable/disable toggling
- **Diagnostics:** Real-time health summary, service status cards, tenant health overview with auto-refresh
- **Analytics:** Platform-wide metrics, risk overview, top tenants by rentals and assets
- **White Label:** Per-company white-label settings management (custom domain, branding, colors, support contacts)
- **i18n:** Full bilingual support (Russian default, English). Uses i18next + react-i18next, language stored in localStorage(`i18n_lang`), toggle in sidebar
- **Dual-mode UI:** Platform users (superAdmin, platformAdmin, etc.) see platform management views (Companies, Billing, Diagnostics, Analytics, White Label). Company users (owner, admin, operator, etc.) see company management views (Fleet, Rentals, Clients, Branches, Settings). Navigation and routes switch based on user type.
- **Role-based Navigation Filtering:** Company navigation is filtered by roleCode from user memberships. Each role sees only relevant sections: owner/admin — all 8 pages; manager — 7 pages (no Settings); operator — 5 pages (Dashboard, Fleet, Map, Rentals, Clients); mechanic — 3 pages (Fleet, Map, Service); accountant — 2 pages (Dashboard, Rentals); viewer — all pages (read-only, all action buttons hidden). Unknown roles are denied by default. Route guards (RoleGuard component) block direct URL access to restricted sections, showing a "Раздел недоступен" page with a link to the first accessible page for the role. Write-permission gating hides create/edit/delete buttons per resource on all CRUD pages (fleet, rentals, clients, branches, service, settings). Same filtering applies to Staff App tabs via `canAccessTab()` with deny-by-default for unknown roles. Permission helpers: `artifacts/platform-admin/src/lib/permissions.ts`, `artifacts/platform-admin/src/hooks/use-role-permissions.ts`, and `artifacts/staff-app/utils/permissions.ts`.
- **Service Module:** Service requests and work orders management with tabbed list views, create/assign dialogs, status transitions. Service requests support request types (flat_tire, brake_issue, battery_problem, etc.), priorities, and mechanic assignment. Work orders link to service requests with cost tracking and resolution fields.
- **Fleet Map:** Real-time vehicle map using Leaflet with OpenStreetMap tiles. Color-coded markers by asset status, battery percentage display, popup details with lock state and speed. Stats cards (total vehicles, on map, offline, average battery). Filters by status and asset type. Uses DISTINCT ON SQL for efficient latest-telemetry-per-asset query.
- **Full CRUD on company pages:** Fleet (create/edit/status change/archive), Rentals (create/approve/start/return/cancel), Clients (create/edit/archive), Branches (create/edit/activate/deactivate), Settings (view/edit company details). All operations use Dialog modals with form validation.
- **Company Dashboard:** Real-time metrics (vehicle count, active rentals, clients, branches), status distribution bars for assets and rentals, recent rentals table.
- **Detail pages:** Asset detail (`/fleet/:id`) and Rental detail (`/rentals/:id`) with full entity info and status history. Clickable table rows in Fleet and Rentals lists navigate to detail views.
- **Status translations:** All status labels (available→Доступен, rented→В аренде, etc.) and asset types (bike→Велосипед, etc.) are fully translated via i18n keys.
- **Routing:** wouter with sidebar navigation, `/platform-admin/` base path
- **API Proxy:** Vite dev proxy forwards `/platform-admin/api/` to API server on port 8080
- **Super Admin credentials:** +375298971111 / 39903990
- **Demo company access:** demo buttons on login page (Velocity Rides Owner/Admin, Urban Wheels Owner, Velocity Rides Operator), password: demo1234

### Technical Implementations
- **Multi-Tenancy:** Enforced via an `x-company-id` header and `companyId` filtering on all database queries.
- **Authentication & Authorization:** Phone number is the primary login identifier. Two login modes: (1) phone+OTP for first-time or passwordless login — in dev mode the OTP code is returned in the API response; (2) phone+password for returning users. On first OTP login, users set a password for subsequent use. Email is stored for receipts/reports only and is optional. JWT (access/refresh tokens with rotation), bcrypt for password hashing, and a permission-based RBAC system. Middleware validates user identity, tenant context, and granular permissions (`resource:action`).
- **Database Schema:** PostgreSQL schema with 26 tables and over 100 indexes, managed by Drizzle ORM, supporting key entities like companies, assets, rentals, and users.
- **Asset & Rental Status Machines:** Enforce valid status transitions and log changes to history tables for auditing.
- **Lead Intake:** Public forms for inquiries, processing leads through a status machine which can convert them into clients or rental drafts.
- **Connected Fleet Foundation (IoT Integration):** Manages IoT devices, handles real-time telemetry data (location, battery, status), tracks batteries, defines GeoJSON geofences, and queues remote device commands. A secure M2M ingestion mechanism allows IoT providers to push telemetry data.
- **Platform Access Model:** Separate platform-level RBAC for five platform roles (superAdmin, platformAdmin, platformSupport, platformFinance, platformRisk) with independent permissions from tenant company memberships. Platform roles are verified on each request.
- **Tenant Moderation:** Companies have a status flow (e.g., `pending`, `active`, `blocked`, `canceled`). Moderation actions are logged, and access is enforced based on company status, with SuperAdmin bypass.
- **SaaS Billing Foundation:** Includes schema for plans, subscriptions, invoices, and payments. Plans define pricing, billing intervals, and resource limits. Subscriptions manage lifecycle states, invoices track billing, and payments record transactions. All billing operations are logged.
- **Platform Blacklist, White-Label, Diagnostics & Analytics:**
    - **Global Blacklist:** Manages cross-tenant client blacklisting based on phone/email/document.
    - **White-Label:** Allows companies to customize branding (custom domains, logos, colors).
    - **Diagnostics:** Provides endpoints for health summaries, service statuses, and individual service checks.
    - **Analytics:** Offers aggregated data for overview, tenants, billing, usage, and risks.

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **API Framework:** Express 5
- **Validation:** Zod
- **Authentication:** JWT, bcrypt
- **API Codegen:** Orval
- **Build Tool:** esbuild
- **Mobile Development:** Expo SDK, React Native
- **Data Fetching (Mobile):** @tanstack/react-query
- **Object Storage:** Google Cloud Storage (GCS) (via Replit App Storage)
- **Testing:** Vitest, supertest