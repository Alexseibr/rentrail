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

**Toast & Snackbar Feedback:** All mutations in Platform Admin pages (fleet, rentals, clients, service, branches) show toast notifications on success and error via `toast()` from `@/hooks/use-toast`. Staff App uses a custom `SnackbarContext` (`contexts/SnackbarContext.tsx`) providing `useSnackbar()` hook with animated snackbar (success green / error red). All toast/snackbar messages are localized (ru/en) under the `toast.*` i18n namespace.

**Sidebar Navigation Grouping:** Platform Admin sidebar items are organized into labeled groups. Company sidebar: "Основное" (Dashboard, Fleet, Map, Rentals) and "Управление" (Clients, Service, Branches, Settings). Platform sidebar: "Основное" (Dashboard, Companies) and "Инструменты" (Billing, Blacklist, Diagnostics, Analytics, White Label). Groups use `NavGroup` interface in `app-layout.tsx`. Collapsed sidebar shows separators between groups; mobile sidebar shows group labels.

**Breadcrumbs:** Detail pages (asset-detail, rental-detail, company-detail, invoice-detail, subscription-detail) use `PageBreadcrumb` component (`components/page-breadcrumb.tsx`) for hierarchical navigation. Pattern: "Parent Page > Current Item". Breadcrumbs replace previous back buttons. In not-found states, a single clickable breadcrumb links back to the parent list.

**Mechanic "My Shift" Screen:** Staff App has a dedicated "My Shift" tab (`app/(tabs)/my-shift.tsx`) for mechanics showing: KPI cards (in progress, assigned, waiting parts), active work orders sorted by priority, and a collapsible "completed today" section. Data is filtered server-side via `GET /api/work-orders?assignedToUserId={userId}`. The tab is visible to mechanic, admin, and owner roles. It's the first tab for mechanics (who don't see the index/dashboard tab).

**Map Cleanup Convention (Staff App):** Any screen that renders a Leaflet map WebView directly (without going through `MiniMapPreview`) must implement a two-layer popup-close contract: (1) a `useFocusEffect` blur callback to close popups when the screen loses focus (navigation, tab switch, modal dismiss), and (2) a `useEffect` cleanup to close popups on full component unmount. `MiniMapPreview` already handles both layers internally — screens using it inherit the safety nets automatically. The full-screen modal reference implementation lives in `artifacts/staff-app/app/maintenance/map.tsx`. Detected by `import WebView from "react-native-webview"` — always use `WebView` as the import identifier (not an alias) to remain visible to the checker.

**Map Cleanup Convention (Platform Admin):** Any component that imports `L` from `"leaflet"` directly must call `map.remove()` inside a `useEffect` return callback. In a React Router web app, navigating away fully unmounts the component, so a single `useEffect` cleanup is sufficient — there is no "blur without unmount" equivalent. Reference implementation: `artifacts/platform-admin/src/pages/fleet-map.tsx`.

A CI script (`pnpm run check-map-cleanup`) enforces both conventions automatically, scanning `artifacts/staff-app/app/` (WebView contract) and `artifacts/platform-admin/src/` (Leaflet contract).

**Pre-commit Hook:** A husky pre-commit hook runs `lint-staged` before every commit. It automatically runs `eslint --fix` and `prettier --write` on staged `.ts`/`.tsx` files, and `prettier --write` on all other staged source files (`.js`, `.mjs`, `.cjs`, `.jsx`, `.json`, `.css`, `.md`, `.yaml`, `.yml`). This prevents lint errors and formatting issues from reaching the repository. The hook is configured in `package.json` under the `"lint-staged"` key, and the hook script lives in `.husky/pre-commit`. If you bypass the hook intentionally use `git commit --no-verify`.

**Type Coverage:** `pnpm run type-coverage` measures the percentage of TypeScript nodes that are explicitly typed (not `any`) across all three artifact packages. Baselines measured 2026-05-08: `api-server` 95.59% (threshold ≥ 99, raised 2026-05-09), `platform-admin` 99.96% (threshold ≥ 99, raised 2026-05-09), `staff-app` 99.51% (threshold ≥ 99, raised 2026-05-09). The check runs as part of `pnpm run ci` after `typecheck`, failing the build on regression. Thresholds are intentionally set 0-1% below baseline to tolerate rounding; raise them as `any` usages are eliminated.

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
