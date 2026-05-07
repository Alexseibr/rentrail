# Go-Live Gates

## Hard Gates (Must Pass Before Production)

### Infrastructure

- [ ] Production PostgreSQL database provisioned and accessible
- [ ] Database migrations applied successfully (`pnpm --filter @workspace/db run push`)
- [ ] RBAC roles and permissions seeded (`pnpm seed`)
- [ ] Object storage bucket configured (DEFAULT_OBJECT_STORAGE_BUCKET_ID)
- [ ] All required environment variables set and validated:
  - `DATABASE_URL` — production PostgreSQL connection string
  - `SESSION_SECRET` — strong random value (32+ characters)
  - `NODE_ENV=production`
  - `PORT` — application port
  - `DEFAULT_OBJECT_STORAGE_BUCKET_ID` — file storage bucket
- [ ] SSL/TLS termination configured for all public endpoints
- [ ] Custom domain configured and DNS propagated
- [ ] Database connection pooling configured for production load

### Health & Monitoring

- [ ] `GET /api/healthz` returns 200 (liveness)
- [ ] `GET /api/health` returns 200 with uptime (readiness)
- [ ] `GET /api/health/full` returns 200 with all checks green (database connectivity)
- [ ] Application logs structured and shipped to log aggregation
- [ ] Error tracking/alerting configured (email or webhook on errors)
- [ ] Database backup schedule verified (daily minimum)
- [ ] Backup restoration tested at least once

### Authentication & Security

- [ ] JWT access token expiration set to 15 minutes
- [ ] Refresh token rotation working correctly
- [ ] Password hashing using bcrypt with 12 rounds in production
- [ ] CORS configured for production domains only
- [ ] Private storage endpoints require authentication
- [ ] SESSION_SECRET is unique and not shared across environments
- [ ] No demo/test credentials present in production
- [ ] Rate limiting configured on auth endpoints

### Tenant Isolation

- [ ] All data queries filter by `companyId`
- [ ] Cross-tenant data access returns 403
- [ ] Branch-level access controls enforce membership
- [ ] File uploads scoped to company namespace
- [ ] Audit logs record all data mutations with actor identity

### Core Workflows

- [ ] User registration and login flow verified
- [ ] Company creation with branch and station setup working
- [ ] Asset CRUD with all status transitions working
- [ ] Rental lifecycle: draft → awaiting_pickup → active → completed
- [ ] Payment create and mark-paid flow working
- [ ] Deposit hold/release/forfeit flow working
- [ ] Blacklist check blocks rental creation for flagged clients
- [ ] Client CRUD with document validation working
- [ ] Incident creation and resolution flow working
- [ ] Maintenance order lifecycle working

### Billing (SaaS)

- [ ] At least one SaaS plan created in platform admin
- [ ] Subscription creation assigns plan to company
- [ ] Invoice generation creates correct amounts
- [ ] Payment recording updates invoice status
- [ ] Plan limits enforced (assets, branches, users per plan)

### Public Endpoints

- [ ] Public company page loads by slug (`/public/:slug`)
- [ ] Public fleet availability returns correct data
- [ ] Public pages respect company branding settings

### Mobile App

- [ ] Staff app authenticates successfully
- [ ] Push notification token registration working
- [ ] Core staff workflows accessible (view rentals, update asset status)

### Platform Admin

- [ ] Super-admin can log in and see dashboard
- [ ] Company list with search, filter, sort working
- [ ] Company detail with all tabs loading data
- [ ] Moderation actions (approve, block, suspend, unblock) working
- [ ] Billing management (plans, subscriptions, invoices) accessible

### Demo Environment

- [ ] Separate demo/staging environment available
- [ ] Demo data seeded for sales demonstrations
- [ ] Demo environment does not share database with production

---

## Soft Gates (Nice-to-Have, Non-Blocking)

### Monitoring

- [ ] Uptime monitoring with external health check pings
- [ ] Performance dashboard (API response times, DB query latency)
- [ ] Disk space and memory usage alerts
- [ ] Slow query logging enabled

### Operations

- [ ] Automated database backup with offsite storage
- [ ] Runbook for common operational tasks documented
- [ ] On-call rotation defined (even if single person)
- [ ] Status page for tenant-facing communication

### Features

- [ ] Email notifications for key events (rental overdue, payment received)
- [ ] CSV export for reports (rentals, payments, clients)
- [ ] Bulk asset import via CSV
- [ ] White-label configuration for at least one tenant

### Documentation

- [ ] API documentation generated or accessible
- [ ] Staff training materials prepared
- [ ] Tenant admin guide drafted
