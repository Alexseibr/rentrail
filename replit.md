# Workspace — Multi-Tenant SaaS Rental Platform

## Overview

This project is a multi-tenant SaaS platform for renting light electric vehicles (bikes, ebikes, scooters). It offers a comprehensive system for companies to manage branches, stations, clients, assets, and rental operations. The platform aims to streamline rental processes, manage fleets, handle client interactions, and provide robust administrative controls, including role-based access. The business vision is to become a leading SaaS solution for micro-mobility rental businesses, focusing on scalability, security, and customization to reduce operational overhead. Future ambitions include IoT integration for real-time telemetry, advanced battery management, and remote asset control.

## User Preferences

I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
I prefer simple language.
I like functional programming.

## System Architecture

The project is a pnpm monorepo using Node.js 24 and TypeScript 5.9. The backend API is built with Express 5, utilizing PostgreSQL with Drizzle ORM, Zod for validation, and JWT with bcrypt for authentication. API codegen is handled by Orval from an OpenAPI spec, and esbuild is used for the build process.

### UI/UX Decisions
A mobile staff application, built with Expo/React Native, provides intuitive workflows for operators, featuring a Yandex Go-inspired design system (dark navigation, amber/yellow accents, light gray content, white cards with shadows). It supports client/courier mode through a separate login flow.

A platform admin web UI, built with React + Vite + shadcn/UI, provides SaaS owners with management capabilities, also using a Yandex Go-inspired design system (dark sidebar, amber/yellow accents, light gray background). It offers platform-level management (Companies, Billing, Diagnostics, Analytics) and company-level views (Fleet, Rentals, Clients, Branches, Settings, Service, Map), with role-based access filtering for navigation and actions.

**Empty States & Onboarding:** All list pages in Platform Admin (Fleet, Rentals, Clients, Branches, Service tabs) use the `Empty` component from `components/ui/empty.tsx` with contextual icons, localized titles/descriptions, and permission-gated CTA buttons. The company dashboard shows a welcome banner with onboarding steps when the company has no branches or vehicles. Staff App screens (assets, work-orders) include descriptive empty state hints.

### Technical Implementations
- **Multi-Tenancy:** Enforced via `x-company-id` header and `companyId` filtering on all database queries.
- **Authentication & Authorization:** Phone number-based login with OTP or password. JWT for access/refresh tokens and a permission-based RBAC system.
- **Database Schema:** PostgreSQL schema with 30+ tables managed by Drizzle ORM.
- **Asset & Rental Status Machines:** Enforce valid status transitions and log changes.
- **Lead Intake:** Public forms for inquiries, processing leads through a status machine.
- **Teltonika GPS Integration:** TCP server for FMB/FMC devices, binary CODEC 8 parser, and command delivery via CODEC 12 packets.
- **Expo Push Notifications:** `push.service.ts` sends notifications via Expo Push API to user devices.
- **Geofence Automation:** Evaluates geofences on telemetry ingest, detecting enter/exit transitions, enforcing speed limits, and auto-enqueueing commands.
- **Payment Gateways:** Unified `PaymentGateway` interface for ЮKassa, Тинькофф, and CloudPayments, supporting hold, capture, void, and refund operations.
- **Rental Payment Flow:** Manages deposit holds, payment capture, voiding, and status refreshing.
- **Rental Blackout Dates:** CRUD for blocked date ranges at company/branch/asset level.
- **Connected Fleet Foundation:** Manages IoT devices, telemetry, batteries, geofences, and remote commands.
- **Platform Access Model:** Separate platform-level RBAC with five roles (superAdmin, platformAdmin, platformSupport, platformFinance, platformRisk).
- **Tenant Moderation:** Companies have a status flow (e.g., `pending`, `active`, `blocked`) with moderation actions logged.
- **SaaS Billing Foundation:** Schema for plans, subscriptions, invoices, and payments.
- **Platform Blacklist, White-Label, Diagnostics & Analytics:** Global client blacklisting, company branding customization, health summaries, and aggregated metrics.

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **API Framework:** Express 5
- **Validation:** Zod
- **Authentication:** JWT, bcrypt
- **API Codegen:** Orval
- **Build Tool:** esbuild
- **Mobile Development:** Expo SDK, React Native
- **Push Notifications:** Expo Push API
- **Payment Gateways:** ЮKassa REST, Тинькофф HMAC, CloudPayments REST