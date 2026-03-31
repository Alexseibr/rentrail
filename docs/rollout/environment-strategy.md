# Environment & Deployment Strategy

## Environment Model

### Local Development
- **Purpose**: Individual developer workstations
- **Database**: Local PostgreSQL or shared dev database
- **Storage**: Local filesystem or dev object storage bucket
- **Seeding**: Demo data via `pnpm seed` (seed-rbac + seed-demo)
- **Access**: Developer only
- **URL**: `localhost:PORT`

### Test / CI
- **Purpose**: Automated test execution
- **Database**: Ephemeral test database per test run
- **Storage**: Mock or test bucket
- **Data**: Created and destroyed per test suite
- **Access**: CI pipeline only
- **Tests**: Unit (vitest), API integration (supertest), tenant isolation

### Staging
- **Purpose**: Pre-production validation, QA, demo environment
- **Database**: Dedicated PostgreSQL instance (separate from production)
- **Storage**: Dedicated object storage bucket
- **Data**: Demo seed data, refreshed weekly or on-demand
- **Access**: Internal team + beta testers
- **URL**: `staging.<domain>.com`
- **Rules**:
  - Mirror production configuration as closely as possible
  - Never share database with production
  - Reset data periodically to prevent drift
  - Use for final validation before production deploys

### Production
- **Purpose**: Live customer-facing environment
- **Database**: Production PostgreSQL with connection pooling
- **Storage**: Production object storage bucket with backups
- **Data**: Real customer data — handle with care
- **Access**: End users, staff, platform admins
- **URL**: `app.<domain>.com` or custom domain
- **Rules**:
  - All changes go through staging first
  - Database migrations require explicit signoff
  - No direct SQL access without audit trail
  - Backups verified daily

---

## Production Deployment Checklist

### Pre-Deploy

1. **Code Review**
   - [ ] All changes reviewed and approved
   - [ ] No known critical bugs in the release
   - [ ] TypeScript typecheck passes (`pnpm typecheck`)
   - [ ] All test suites pass

2. **Database**
   - [ ] Migration plan reviewed (schema changes identified)
   - [ ] Migrations tested on staging first
   - [ ] Backup taken immediately before migration
   - [ ] Rollback SQL prepared for destructive changes

3. **Secrets & Configuration**
   - [ ] New environment variables added to production
   - [ ] No secrets hardcoded in application code
   - [ ] Feature flags set appropriately

### Deploy Steps

1. **Database Migration** (if schema changes)
   ```bash
   # Take backup
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

   # Apply migrations
   pnpm --filter @workspace/db run push
   ```

2. **Application Deploy**
   - Deploy via Replit Deployments (autoscale target)
   - Post-build step: `pnpm store prune`
   - Health check endpoint: `/api/healthz`

3. **Post-Deploy Verification**
   - [ ] `/api/healthz` returns 200
   - [ ] `/api/health/full` shows all checks green
   - [ ] Login flow works (web + mobile)
   - [ ] Dashboard loads with correct metrics
   - [ ] One test rental cycle completes successfully

### Infrastructure Requirements

| Component | Requirement | Notes |
|-----------|-------------|-------|
| PostgreSQL | 14+ | With connection pooling |
| Node.js | 24.x | As configured in .replit |
| Object Storage | Replit Object Storage | For file uploads |
| SSL/TLS | Required | Managed by Replit Deployments |
| Domain | Custom domain recommended | Replit provides `.replit.app` default |
| Memory | 512MB minimum | Scale based on tenant count |
| Backup | Daily automated | Database + object storage |

### Monitoring Setup

| Signal | Tool | Threshold |
|--------|------|-----------|
| Uptime | External ping to `/api/healthz` | Alert if down > 2 min |
| API Latency | Application logs | Alert if p95 > 1s |
| Error Rate | Log aggregation | Alert if > 5 errors/min |
| DB Connections | PostgreSQL monitoring | Alert if pool > 80% |
| Disk Usage | System metrics | Alert if > 85% |
| Memory | System metrics | Alert if > 90% |

### Backup Strategy

- **Database**: Daily automated pg_dump, retained 30 days
- **Object Storage**: Provider-managed replication
- **Backup Testing**: Monthly restore drill to staging
- **Point-in-Time Recovery**: Enable WAL archiving if supported
- **Backup Location**: Different region/provider from primary

### Cron Jobs / Scheduled Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| Database backup | Daily 02:00 UTC | pg_dump to backup storage |
| Overdue rental check | Hourly | Flag rentals past end date |
| Subscription billing | Daily 06:00 UTC | Generate invoices for due subscriptions |
| Session cleanup | Daily 03:00 UTC | Remove expired sessions |
| Telemetry cleanup | Weekly | Archive old telemetry snapshots |
