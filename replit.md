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

## Database Schema (26 tables, 100+ indexes)

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
- inquiryStatus: new, in_review, contacted, converted, rejected, spam, archived
- b2bRequestStatus: new, in_review, contacted, negotiating, converted, rejected, archived
- notificationType: inquiry_created, inquiry_assigned, inquiry_converted, b2b_request_created, b2b_request_assigned, payment_created, payment_paid, rental_started, rental_overdue, incident_created, maintenance_created

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

#### Lead Intake
- **inquiries** — public rental inquiries; fullName, phone, email, assetType, preferredAssetId, requestedStartAt/EndAt, message, blacklistCheckResult jsonb; status machine (new→in_review→contacted→converted/rejected/spam→archived); convertedClientId, convertedRentalId tracking
- **b2b_requests** — B2B partnership inquiries; companyName, contactPerson, phone, email, city, requestedFleetSize, assetTypes jsonb, message; status machine (new→in_review→contacted→negotiating→converted/rejected→archived); assignedToUserId, notesInternal

#### Company Config
- **company_branding** — public page config per company (1:1); logo, colors, contact info, social links, publicEnabled flag, publicShow* toggles for assets/pricing/stations/forms
- **company_modules** — feature flags per company; moduleCode + enabled; unique on (companyId, moduleCode)

#### Notifications
- **notifications** — in-app notifications per user; type enum, title, body, data jsonb, readAt

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
- All queries filter by `companyId` — no cross-tenant data leakage

### Access Control Middleware (permission-based, NOT hardcoded role names)

Routes use a reusable middleware chain — no role names in handlers:

```
authenticate → requireCompanyAccess → requirePermission("asset:create")
```

- **`authenticate`** — validates JWT, sets `req.user` (userId, email, isSuperAdmin)
- **`requireCompanyAccess`** — validates `x-company-id`, loads membership + role + all permissions into `req.tenant.permissions` (Set<string>). One DB query per request, cached in context.
- **`requirePermission("code")`** — checks the loaded Set (zero DB queries). Accepts one or more codes (all must match).
- **`requireAnyPermission("a", "b")`** — at least one must match.
- **`requireSuperAdmin`** — platform-level operations (e.g., create company).
- **`requireBranchAccess()`** — validates branch membership; owner/admin bypass.

### Permission Resolution
- **superAdmin** → bypasses all checks (platform-level)
- **owner** → all permissions on all resources (57 total)
- **admin** → all except company:manage, role:manage (55)
- **manager** → branch/station/client/asset/rental/blacklist CRUD + granular ops (29)
- **accountant** → payment/deposit full + read access to related resources (12)
- **operator** → client/asset/rental CRUD + start/extend/complete + changeStatus (19)
- **mechanic** → asset read/update/changeStatus + branch/station read (5)
- **viewer** → read-only on all resources (13)

## API Endpoints (all under /api)

### Auth
- `POST /auth/register` — register user
- `POST /auth/login` — login, get tokens + mustChangePassword flag
- `POST /auth/refresh` — refresh tokens (token rotation, reuse detection)
- `POST /auth/logout` — logout (current session revocation)
- `POST /auth/logout-all` — revoke all sessions
- `GET /auth/me` — current user + company memberships + branch memberships
- `GET /auth/permissions` — effective permissions for current user + company (requires x-company-id)

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
- `POST /assets` — create asset (default status=draft)
- `GET /assets` — list assets (?branchId=&status=)
- `GET /assets/:id` — get asset
- `PATCH /assets/:id` — update asset fields (status NOT changeable via PATCH)
- `POST /assets/:id/status` — change asset status (enforces transition rules)
- `POST /assets/:id/archive` — soft-delete asset
- `POST /assets/:id/restore` — restore archived asset
- `GET /assets/:id/status-history` — get asset status change log

### Rentals (requires x-company-id)
- `POST /rentals` — create rental (validates asset availability, checks blacklist, prevents duplicate active rental)
- `GET /rentals` — list rentals (?status=)
- `GET /rentals/:id` — get rental
- `GET /rentals/:id/status-history` — get rental status change log
- `POST /rentals/:id/approve` — approve rental (draft/pending→awaiting_payment)
- `POST /rentals/:id/start` — start rental (awaiting_pickup→active, sets asset to rented, re-checks blacklist)
- `POST /rentals/:id/extend` — extend rental (active/extended→extended, updates plannedEndAt)
- `POST /rentals/:id/return` — return rental (active/extended/overdue/return_requested→completed, sets actualEndAt, optional returnedToStationId, optional assetReturnStatus)
- `POST /rentals/:id/cancel` — cancel rental (rolls back asset status if was active/extended/overdue)

### Blacklist (requires x-company-id)
- `POST /blacklist` — create entry (auto-snapshots client data)
- `GET /blacklist` — list entries
- `POST /blacklist/check` — check client against blacklist

### Public (no auth, rate-limited)
- `GET /public/companies/:slug` — public company page (requires publicEnabled)
- `GET /public/companies/:slug/assets` — public asset list (requires publicShowAssets)
- `GET /public/companies/:slug/stations` — public station list (requires publicShowStations)
- `POST /public/companies/:slug/inquiries` — submit rental inquiry (lead intake only)
- `POST /public/companies/:slug/b2b-request` — submit B2B partnership request

### Inquiries (requires x-company-id)
- `GET /inquiries` — list inquiries (?status=)
- `GET /inquiries/:id` — get inquiry
- `PATCH /inquiries/:id` — update inquiry fields
- `POST /inquiries/:id/mark-contacted` — mark inquiry as contacted
- `POST /inquiries/:id/convert-to-client` — create/find client from inquiry
- `POST /inquiries/:id/convert-to-rental-draft` — create rental draft from converted inquiry
- `POST /inquiries/:id/reject` — reject inquiry

### B2B Requests (requires x-company-id)
- `GET /b2b-requests` — list B2B requests (?status=)
- `GET /b2b-requests/:id` — get B2B request
- `PATCH /b2b-requests/:id` — update notes/assignment
- `POST /b2b-requests/:id/mark-contacted` — mark as contacted
- `POST /b2b-requests/:id/convert` — convert B2B request
- `POST /b2b-requests/:id/reject` — reject B2B request

### Notifications
- `GET /notifications` — list user notifications (optional x-company-id filter)
- `POST /notifications/:id/read` — mark notification as read
- `POST /notifications/read-all` — mark all notifications as read

### Company Settings (requires x-company-id)
- `GET /companies/me/branding` — get company branding
- `PATCH /companies/me/branding` — update branding + public page config
- `GET /companies/me/modules` — get feature modules
- `PATCH /companies/me/modules` — enable/disable modules

## Running

- Dev server: `pnpm --filter @workspace/api-server run dev`
- Build: `pnpm --filter @workspace/api-server run build`
- Push DB schema: `pnpm --filter @workspace/db run push`
- Seed RBAC: `pnpm --filter @workspace/scripts run seed-rbac`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- Typecheck: `pnpm run typecheck`

## Asset Status Machine
```
draft → available / maintenance / retired
available → reserved / awaiting_pickup / rented / charging / maintenance / blocked / lost / stolen / retired
reserved → available / awaiting_pickup / canceled / maintenance / blocked
awaiting_pickup → rented / available / canceled / maintenance / blocked
rented → available / overdue / charging / maintenance / lost / stolen
overdue → available / charging / maintenance / blocked / lost / stolen / defaulted
charging → available / maintenance
maintenance → available / retired / blocked
blocked → available / maintenance / retired
lost → available / retired
stolen → available / retired
retired → (terminal, no transitions out)
```
- Status changes only via `POST /assets/:id/status` (PATCH ignores status field)
- Archived assets cannot change status
- Every transition logged to `asset_status_history`

## Rental Status Machine
```
draft → pending_approval / awaiting_payment / awaiting_pickup / canceled
pending_approval → awaiting_payment / awaiting_pickup / canceled
awaiting_payment → awaiting_pickup / canceled
awaiting_pickup → active / canceled
active → extended / overdue / return_requested / completed / canceled
extended → overdue / return_requested / completed / canceled
overdue → return_requested / completed / defaulted
return_requested → completed
completed, canceled, defaulted — terminal states
```
- Transitions enforced by workflow action endpoints (approve/start/extend/return/cancel)
- No free PATCH of status — each action validates preconditions
- Every transition logged to `rental_status_history`

### Rental Workflow Actions
- **create**: validates asset availability, prevents duplicate active rental on same asset, checks blacklist (hard block or warning flags)
- **approve**: draft/pending → awaiting_payment
- **start**: awaiting_pickup → active; sets asset→rented; re-checks blacklist at start time
- **extend**: active/extended → extended; updates plannedEndAt
- **return**: active/extended/overdue/return_requested → completed; sets actualEndAt; validates returnedToStationId; sets asset to available/maintenance/charging
- **cancel**: from any non-terminal status; rolls back asset to available if was active/extended/overdue

## Permissions (resource:action)

### By Module
- **platform**: company:read, company:update, company:manage
- **organization**: branch:create/read/update/delete/manage, station:create/read/update/delete/manage
- **crm**: client:create/read/update/delete/manage, inquiry:create/read/update/manage, b2b:create/read/update/manage
- **fleet**: asset:create/read/update/delete/changeStatus/manage
- **operations**: rental:create/read/update/approve/start/extend/complete/cancel/manage, blacklist:create/read/update/check/manage
- **finance**: payment:create/read/refund/manage, deposit:create/read/update/manage
- **access**: user:create/read/update/delete/manage, role:read/manage
- **system**: audit:read, settings:read/update/manage
- **notifications**: notification:read

### Granular Actions (beyond CRUD)
- `asset:changeStatus` — change asset operational status
- `rental:approve` — approve pending rental
- `rental:start` — activate rental
- `rental:extend` — extend active rental
- `rental:complete` — complete rental
- `rental:cancel` — cancel rental
- `blacklist:check` — check client against blacklist
- `payment:refund` — process payment refund

## Lead Intake Rules
- Public inquiry/B2B forms are **lead intake only** — they do NOT create active rentals
- `convertToClient` creates or finds an existing client by phone
- `convertToRentalDraft` creates a draft rental (status=draft) — NOT an active rental
- Inquiry conversion requires client to exist first (convert-to-client before convert-to-rental-draft)
- Blacklist check runs at inquiry creation if phone matches existing client
- Public endpoints only accessible when company has `publicEnabled=true` and is not blocked/canceled

## Company Modules
Available modules: public_page, inquiries, b2b_requests, rentals, payments, blacklist, incidents, maintenance, telemetry, batteries, notifications
- Platform-managed modules (telemetry, batteries) can only be toggled by superAdmin
- Module state stored in company_modules table (companyId + moduleCode unique)

## Phase 2 (future)
Tables to add: telemetry, devices, batteries, geofences, incidents
