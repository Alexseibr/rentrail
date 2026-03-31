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
A mobile staff application, built with Expo/React Native, provides intuitive workflows for operators. It features tab-based navigation, modal screens for specific actions (e.g., QR scanning, incident creation), and offline-first capabilities with an AsyncStorage queue for data synchronization.

A platform admin web UI, built with React + Vite + shadcn/UI, provides SaaS owners with management capabilities. It features:
- **Auth:** JWT-based login with automatic token refresh, stored in-memory with localStorage persistence
- **Dashboard:** Overview metrics from analytics and health endpoints
- **Companies:** List/detail views with search, filtering, pagination, moderation actions (approve/block/suspend/unblock/cancel), usage and health tabs
- **Billing:** Plans management (CRUD), subscriptions list with status filtering, invoices with mark-paid capability
- **Global Blacklist:** CRUD with identity-based entries (name/email/phone/document), enable/disable toggling
- **Diagnostics:** Real-time health summary, service status cards, tenant health overview with auto-refresh
- **Analytics:** Platform-wide metrics, risk overview, top tenants by rentals and assets
- **White Label:** Per-company white-label settings management (custom domain, branding, colors, support contacts)
- **Routing:** wouter with sidebar navigation, `/platform-admin/` base path
- **API Proxy:** Vite dev proxy forwards `/platform-admin/api/` to API server on port 8080

### Technical Implementations
- **Multi-Tenancy:** Enforced via an `x-company-id` header and `companyId` filtering on all database queries.
- **Authentication & Authorization:** JWT (access/refresh tokens with rotation), bcrypt for password hashing, and a permission-based Role-Based Access Control (RBAC) system. Middleware validates user identity, tenant context, and granular permissions (`resource:action`).
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