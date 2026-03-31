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
│   │   └── build.mjs         # esbuild config
│   └── mockup-sandbox/       # Canvas design sandbox
├── lib/
│   ├── api-spec/             # OpenAPI spec + Orval codegen config
│   ├── api-client-react/     # Generated React Query hooks
│   ├── api-zod/              # Generated Zod schemas from OpenAPI
│   └── db/                   # Drizzle ORM schema + DB connection
│       └── src/schema/       # All table definitions
├── scripts/
│   └── src/
│       └── seed-rbac.ts      # Seeds roles & permissions
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

## Database Schema (lib/db)

### Platform / SaaS
- **companies** — tenants; each company is isolated
- **company_settings** — key-value config per company
- **branches** — city/region units within a company
- **stations** — pickup/drop-off points within a branch

### Access (RBAC)
- **users** — platform users (email + password hash)
- **roles** — system roles: superAdmin, owner, admin, manager, accountant, operator, mechanic, viewer
- **permissions** — resource:action pairs (e.g. `asset:create`)
- **role_permissions** — maps roles to permissions
- **user_company_memberships** — links users to companies with a role
- **user_branch_memberships** — optionally scopes users to specific branches
- **sessions** — JWT refresh token sessions

### Clients
- **clients** — end-users/couriers who rent vehicles

### Assets
- **assets** — transport units (bike, ebike, scooter, escooter)
- **asset_status_history** — tracks every status change

### Rentals
- **rental_plans** — pricing plans (hourly, daily, weekly, monthly, subscription)
- **rentals** — rental transactions with full status machine
- **rental_status_history** — tracks every rental status change

### Finance
- **payments** — payment records
- **deposits** — deposit holds and returns

### Safety
- **blacklist_entries** — client restrictions at branch/company/global level

### Audit
- **audit_logs** — who did what, when, with old/new values

## Auth System

- JWT access tokens (15min) + refresh tokens (7 days)
- Passwords hashed with bcrypt (12 rounds)
- Session-based refresh with token rotation
- `SESSION_SECRET` env var used as JWT signing key

## Multi-Tenant Architecture

- Every tenant-scoped request requires `x-company-id` header
- `requireCompany` middleware extracts tenant context
- `requireRole` middleware checks user's role in the target company
- `requirePermission` middleware checks granular resource:action permissions
- All queries filter by `companyId` — no cross-tenant data leakage

## API Endpoints (all under /api)

### Auth
- `POST /auth/register` — register user
- `POST /auth/login` — login, get tokens
- `POST /auth/refresh` — refresh tokens
- `POST /auth/logout` — logout (requires auth)
- `GET /auth/me` — current user + memberships

### Companies
- `POST /companies` — create company
- `GET /companies` — list companies
- `GET /companies/:id` — get company
- `PATCH /companies/:id` — update company

### Branches (requires x-company-id)
- `POST /branches` — create branch
- `GET /branches` — list branches
- `GET /branches/:id` — get branch
- `PATCH /branches/:id` — update branch

### Stations (requires x-company-id)
- `POST /stations` — create station
- `GET /stations` — list stations (?branchId=)
- `GET /stations/:id` — get station
- `PATCH /stations/:id` — update station

### Clients (requires x-company-id)
- `POST /clients` — create client
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
- `POST /rentals` — create rental
- `GET /rentals` — list rentals (?status=)
- `GET /rentals/:id` — get rental
- `POST /rentals/:id/approve` — approve rental
- `POST /rentals/:id/start` — start rental
- `POST /rentals/:id/extend` — extend rental
- `POST /rentals/:id/complete` — complete rental
- `POST /rentals/:id/cancel` — cancel rental

### Blacklist (requires x-company-id)
- `POST /blacklist` — create entry
- `GET /blacklist` — list entries
- `POST /blacklist/check` — check client against blacklist

## Running

- Dev server: `pnpm --filter @workspace/api-server run dev`
- Build: `pnpm --filter @workspace/api-server run build`
- Push DB schema: `pnpm --filter @workspace/db run push`
- Seed RBAC: `pnpm --filter @workspace/scripts run seed-rbac`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- Typecheck: `pnpm run typecheck`

## Asset Types
bike, ebike, scooter, escooter

## Asset Statuses
draft, available, reserved, awaiting_pickup, rented, overdue, charging, maintenance, blocked, lost, stolen, retired

## Rental Statuses (with transition machine)
draft → pending_approval / awaiting_payment / canceled
pending_approval → awaiting_payment / awaiting_pickup / canceled
awaiting_payment → awaiting_pickup / canceled
awaiting_pickup → active / canceled
active → extended / overdue / return_requested / completed / canceled
extended → overdue / return_requested / completed / canceled
overdue → return_requested / completed / defaulted
return_requested → completed
completed, canceled, defaulted — terminal states

## Blacklist Levels
branch, company, global

## Blacklist Actions
warning, manual_approval_only, increased_deposit, restricted_access, blocked_branch, blocked_company, blocked_global
