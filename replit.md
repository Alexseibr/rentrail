# Workspace — Multi-Tenant SaaS Rental Platform

## Overview

pnpm workspace monorepo for a multi-tenant SaaS platform for renting bikes, ebikes, scooters, and escooters. Each company is a separate tenant with branches, stations, clients, assets, and rentals.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Auth**: JWT (access + refresh tokens), bcrypt
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Structure

```text
workspace/
├── artifacts/
│   ├── api-server/           # Express 5 API server
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point
│   │   │   ├── app.ts        # Express app setup
│   │   │   ├── lib/          # Config, JWT, errors, audit
│   │   │   ├── middlewares/  # Auth, RBAC, validation, error handler
│   │   │   ├── services/     # Business logic layer
│   │   │   └── routes/       # Thin route handlers
│   │   └── build.mjs         # esbuild config (custom zod/v4 plugin)
│   └── mockup-sandbox/       # Canvas design sandbox
├── lib/
│   ├── api-spec/             # OpenAPI spec + Orval codegen config
│   ├── api-client-react/     # Generated React Query hooks
│   ├── api-zod/              # Generated Zod schemas from OpenAPI
│   └── db/                   # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── enums.ts       # All pgEnum definitions
│           ├── companies.ts   # companies table
│           ├── company-settings.ts
│           ├── branches.ts
│           ├── stations.ts
│           ├── users.ts
│           ├── roles.ts       # code-based (not name-based)
│           ├── permissions.ts  # code + module based
│           ├── role-permissions.ts # composite PK
│           ├── user-company-memberships.ts
│           ├── user-branch-memberships.ts # has companyId + roleId + status
│           ├── sessions.ts    # refreshTokenHash (SHA-256, not plaintext)
│           ├── clients.ts     # fullName (not first/last), status enum, rating, archivedAt
│           ├── assets.ts      # composite unique on (companyId, serialNumber), (companyId, qrCode)
│           ├── asset-status-history.ts  # has companyId
│           ├── rental-plans.ts
│           ├── rentals.ts     # tariffSnapshot jsonb, issuedByUserId, returnedToStationId
│           ├── rental-status-history.ts # has companyId
│           ├── payments.ts    # paymentType enum, provider, providerPaymentId, metadata jsonb
│           ├── deposits.ts    # heldAt, releasedAt
│           ├── blacklist-entries.ts  # scopeType, snapshots, reasonCode, startsAt/endsAt
│           ├── audit-logs.ts  # before/after jsonb, metadata jsonb, branchId, actorUserId
│           ├── relations.ts   # All Drizzle relations() definitions
│           └── index.ts       # Re-exports everything
├── scripts/
│   └── src/
│       └── seed-rbac.ts      # Seeds roles, permissions (with modules), role-permission mappings
├── pnpm-workspace.yaml       # bcrypt in onlyBuiltDependencies
├── tsconfig.base.json
└── tsconfig.json
```

## Database Schema (21 tables, 100+ indexes)

### Enums (lib/db/src/schema/enums.ts)
- companyStatus: pending, trial, active, past_due, blocked, canceled
- branchStatus: active, inactive, closed
- stationStatus: active, inactive, maintenance, closed
- stationType: hub, pickup_point, service_center, warehouse
- membershipStatus: invited, active, suspended, disabled
- clientStatus: active, suspended, blocked, archived
- assetType: bike, ebike, scooter, escooter
- assetStatus: draft, available, reserved, awaiting_pickup, rented, overdue, charging, maintenance, blocked, lost, stolen, retired
- rentalType: hourly, daily, weekly, monthly, subscription
- rentalStatus: draft, pending_approval, awaiting_payment, awaiting_pickup, active, extended, overdue, return_requested, completed, canceled, disputed, defaulted
- paymentStatus: pending, authorized, paid, failed, refunded, partially_refunded, chargeback
- paymentType: rental_payment, deposit_hold, deposit_release, fine, refund, adjustment, manual_charge
- depositStatus: held, partially_released, released, forfeited
- blacklistScope: branch, company, global
- blacklistActionType: warning, manual_approval_only, increased_deposit, restricted_access, blocked_branch, blocked_company, blocked_global

### Tables

#### Platform / Tenant
- **companies** — tenants with status enum (pending → active → canceled)
- **company_settings** — key-value config per company (unique on companyId+key)
- **branches** — city/region units with status enum
- **stations** — pickup/drop-off points with type enum, lat/lng, status

#### Access (RBAC)
- **users** — email + passwordHash + mustChangePassword + twoFactorEnabled
- **roles** — code-based (superAdmin, owner, admin, manager, accountant, operator, mechanic, viewer), isSystem flag
- **permissions** — code (resource:action), name, module (platform/organization/crm/fleet/operations/finance/access/system)
- **role_permissions** — composite PK (roleId, permissionId)
- **user_company_memberships** — userId + companyId + roleId + status (membershipStatus), unique on (userId, companyId, roleId)
- **user_branch_memberships** — userId + companyId + branchId + roleId + status, unique on (userId, branchId, roleId)
- **sessions** — refreshTokenHash (SHA-256), revokedAt (soft revocation), expiresAt, ip, userAgent

#### Clients
- **clients** — fullName, phone, email, birthday, documentType/Number, status, rating, archivedAt; composite unique on (companyId, phone) and (companyId, documentNumber)

#### Assets
- **assets** — assetType, brand, model, serialNumber, internalCode, qrCode, purchasePrice, currentValue, isPublic, archivedAt; composite unique on (companyId, serialNumber) and (companyId, qrCode)
- **asset_status_history** — companyId, fromStatus, toStatus, changedByUserId

#### Rentals
- **rental_plans** — rentalType, price, currency, depositAmount, billingInterval
- **rentals** — tariffSnapshot jsonb, issuedByUserId, returnedToStationId, startAt, plannedEndAt, actualEndAt; composite indexes on (companyId, clientId, status), (companyId, assetId, status)
- **rental_status_history** — companyId, fromStatus, toStatus, changedByUserId

#### Finance
- **payments** — paymentType enum, provider, providerPaymentId, metadata jsonb, paidAt
- **deposits** — heldAt, releasedAt, status enum (held → released/forfeited)

#### Safety
- **blacklist_entries** — scopeType (branch/company/global), client snapshots (fullNameSnapshot, phoneSnapshot, emailSnapshot, documentSnapshot), actionType, reasonCode, startsAt/endsAt

#### Audit
- **audit_logs** — actorUserId, before/after jsonb, metadata jsonb, branchId, ip, userAgent

### Relations (lib/db/src/schema/relations.ts)
All Drizzle `relations()` defined for every table — enables relational queries with `db.query.companies.findMany({ with: { branches: true } })`.

## Auth System

- JWT access tokens (15min) + refresh tokens (7 days) with token rotation
- Refresh tokens hashed with SHA-256 before storage (not plaintext)
- Token reuse detection: if old refresh token is reused, session is revoked
- Session revocation via `revokedAt` field (soft delete, not hard delete)
- Passwords hashed with bcrypt (12 rounds)
- `mustChangePassword` flag for forced password reset
- `twoFactorEnabled` flag (ready for 2FA integration)
- `SESSION_SECRET` env var used as JWT signing key

## Multi-Tenant Architecture

- Every tenant-scoped request requires `x-company-id` header
- `requireCompany` middleware — extracts tenant context
- `requireRole` middleware — checks user's role code in the target company, validates membership status is "active"
- `requirePermission` middleware — checks granular permission code (e.g. `asset:create`)
- `requireBranch` middleware — extracts branch context from `x-branch-id`
- `requireBranchAccess` middleware — validates user has branch membership (owner/admin bypass)
- All queries filter by `companyId` — no cross-tenant data leakage

## API Endpoints (all under /api)

### Auth
- `POST /auth/register` — register user
- `POST /auth/login` — login, get tokens + mustChangePassword flag
- `POST /auth/refresh` — refresh tokens (token rotation, reuse detection)
- `POST /auth/logout` — logout (session revocation)
- `GET /auth/me` — current user + company memberships + branch memberships

### Companies
- `POST /companies` — create company (status defaults to "pending")
- `GET /companies` — list companies
- `GET /companies/:id` — get company
- `PATCH /companies/:id` — update company

### Branches (requires x-company-id)
- `POST /branches` — create branch
- `GET /branches` — list branches
- `GET /branches/:id` — get branch
- `PATCH /branches/:id` — update branch

### Stations (requires x-company-id)
- `POST /stations` — create station (with type, lat, lng)
- `GET /stations` — list stations (?branchId=)
- `GET /stations/:id` — get station
- `PATCH /stations/:id` — update station

### Clients (requires x-company-id)
- `POST /clients` — create client (fullName based)
- `GET /clients` — list clients
- `GET /clients/:id` — get client
- `PATCH /clients/:id` — update client

### Assets (requires x-company-id)
- `POST /assets` — create asset
- `GET /assets` — list assets (?branchId=&status=)
- `GET /assets/:id` — get asset
- `PATCH /assets/:id` — update asset
- `POST /assets/:id/status` — change asset status

### Rentals (requires x-company-id)
- `POST /rentals` — create rental (with tariffSnapshot, issuedByUserId)
- `GET /rentals` — list rentals (?status=)
- `GET /rentals/:id` — get rental
- `POST /rentals/:id/approve` — approve rental
- `POST /rentals/:id/start` — start rental
- `POST /rentals/:id/extend` — extend rental
- `POST /rentals/:id/complete` — complete rental
- `POST /rentals/:id/cancel` — cancel rental

### Blacklist (requires x-company-id)
- `POST /blacklist` — create entry (auto-snapshots client data)
- `GET /blacklist` — list entries
- `POST /blacklist/check` — check client against blacklist

## Running

- Dev server: `pnpm --filter @workspace/api-server run dev`
- Build: `pnpm --filter @workspace/api-server run build`
- Push DB schema: `pnpm --filter @workspace/db run push`
- Seed RBAC: `pnpm --filter @workspace/scripts run seed-rbac`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- Typecheck: `pnpm run typecheck`

## Rental Status Machine
draft → pending_approval / awaiting_payment / canceled
pending_approval → awaiting_payment / awaiting_pickup / canceled
awaiting_payment → awaiting_pickup / canceled
awaiting_pickup → active / canceled
active → extended / overdue / return_requested / completed / canceled
extended → overdue / return_requested / completed / canceled
overdue → return_requested / completed / defaulted
return_requested → completed
completed, canceled, defaulted — terminal states

## Permission Modules
- platform: company
- organization: branch, station
- crm: client
- fleet: asset
- operations: rental, blacklist
- finance: payment, deposit
- access: user, role
- system: audit, settings

## Phase 2 (future)
Tables to add: telemetry, devices, batteries, geofences, incidents, notifications
