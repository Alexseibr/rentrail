# Release Readiness Checklist

## Environment
- [ ] All required environment variables set and validated (DATABASE_URL, SESSION_SECRET, PORT)
- [ ] NODE_ENV set to `production`
- [ ] Object storage bucket configured (DEFAULT_OBJECT_STORAGE_BUCKET_ID)
- [ ] Telemetry API key configured if using M2M ingest

## Database
- [ ] Migrations/schema pushed to production DB (`pnpm --filter @workspace/db run push`)
- [ ] RBAC roles and permissions seeded (`pnpm seed`)
- [ ] Demo data NOT present in production
- [ ] Backup strategy defined and tested
- [ ] Connection pooling configured

## Tests
- [ ] Unit tests pass (`pnpm test:unit`)
- [ ] API tests pass (`pnpm test:api`)
- [ ] Integration tests pass (`pnpm test:integration`)
- [ ] Tenant isolation tests pass
- [ ] No critical type errors (`pnpm typecheck`)

## Health & Observability
- [ ] GET /api/health returns 200
- [ ] GET /api/health/full shows all checks green
- [ ] Structured logging active with correlation IDs
- [ ] Error tracking configured (provider integrated or logger-based)
- [ ] Log level set appropriately for production

## Auth & Security
- [ ] SESSION_SECRET is strong (32+ chars, random)
- [ ] JWT access tokens expire in 15 minutes
- [ ] Refresh token rotation working
- [ ] Password hashing uses bcrypt (12 rounds in production)
- [ ] CORS configured for production domains only
- [ ] Private storage endpoints require authentication

## Core Workflows
- [ ] User registration and login flow verified
- [ ] Company/branch creation working
- [ ] Asset CRUD with status transitions working
- [ ] Rental lifecycle: create → approve → start → return → complete
- [ ] Payment create and mark paid working
- [ ] Deposit hold/release/forfeit working
- [ ] Blacklist check blocks rentals correctly
- [ ] Incident creation and status transitions working
- [ ] Maintenance order lifecycle working

## Public Endpoints
- [ ] Public company page loads by slug
- [ ] Inquiry form submission working
- [ ] B2B request form submission working
- [ ] Public pages respect company module settings

## Telemetry & IoT
- [ ] Telemetry ingest endpoint authenticated (API key)
- [ ] Device → company → asset resolution working
- [ ] Location history recording working
- [ ] Battery status tracking working

## Mobile App
- [ ] Login and token refresh working
- [ ] Company/branch context selection working
- [ ] QR scanner resolves assets correctly
- [ ] Offline queue processes on reconnect
- [ ] Push notification registration working
- [ ] Photo upload via presigned URL working

## Performance
- [ ] Asset list endpoint responds under 500ms
- [ ] Rental list endpoint responds under 500ms
- [ ] Dashboard summary responds under 1s
- [ ] Database indexes present for all foreign keys and common queries

## Deployment
- [ ] CI pipeline passing (lint, typecheck, tests, build)
- [ ] Production build succeeds
- [ ] Health check endpoint accessible after deploy
- [ ] SSL/TLS configured
- [ ] Domain configured
