# Incident & Rollback Plan

## Severity Model

### SEV-1: Critical
**Definition**: Platform is fully unavailable, data loss occurring, or security breach detected.

- **Examples**: Database unreachable, authentication system down, data leak between tenants, ransomware
- **Response time**: 15 minutes
- **Resolution target**: 1 hour
- **Notification**: All affected tenants within 30 minutes
- **Post-incident review**: Required within 24 hours

### SEV-2: Major
**Definition**: Core feature broken for all tenants or significant degradation.

- **Examples**: Rental creation fails globally, payment recording broken, mobile app cannot authenticate, search returns wrong results
- **Response time**: 1 hour
- **Resolution target**: 4 hours
- **Notification**: Affected tenants within 2 hours
- **Post-incident review**: Required within 48 hours

### SEV-3: Minor
**Definition**: Non-critical feature broken or issue affecting single tenant.

- **Examples**: Report export fails, notification delivery delayed, one tenant's white-label settings not loading, UI cosmetic issue
- **Response time**: 4 hours
- **Resolution target**: 24 hours
- **Notification**: Affected tenant only, if impact is visible
- **Post-incident review**: Optional

---

## Rollback Procedures

### 1. Application Rollback (Bad Deploy)

**Symptoms**: Errors immediately after deployment, new bugs in previously working features.

**Procedure**:
1. Confirm the issue is related to the new deploy (check timestamps)
2. Roll back to previous deployment version via Replit Deployments
3. Verify health endpoints return 200
4. Test core workflows (login, rental creation, asset listing)
5. Notify team of rollback
6. Investigate root cause before re-deploying

**Prevention**: Always deploy to staging first, run smoke tests before production.

### 2. Database Migration Rollback

**Symptoms**: Application errors after schema change, data access failures.

**Procedure**:
1. **Do not panic** — assess the scope of the migration
2. If migration was additive only (new tables/columns):
   - Usually safe to leave in place
   - Roll back application code if it relies on new schema
3. If migration was destructive (dropped columns, changed types):
   - Restore from pre-migration backup immediately
   ```bash
   # Restore from backup
   psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql
   ```
   - Roll back application code to match previous schema
   - Verify data integrity after restore
4. Notify all tenants if any data loss occurred

**Prevention**: Always take backup before migration. Test migrations on staging. Prepare rollback SQL for destructive changes. Never drop columns in the same release that removes code references.

### 3. Authentication System Failure

**Symptoms**: Users cannot log in, JWT validation errors, session issues.

**Procedure**:
1. Check if `SESSION_SECRET` was changed → if so, all existing tokens are invalidated (expected)
2. Check database connectivity (sessions table)
3. Check JWT signing configuration
4. If secret rotation caused it:
   - Users must re-login (expected behavior)
   - Communicate to tenants: "Scheduled security update requires re-login"
5. If auth service is down:
   - Check application logs for errors
   - Restart application
   - If persists: check database connection pool

**Prevention**: Rotate secrets during maintenance windows. Test auth flow after any security changes.

### 4. Tenant Isolation Failure

**Symptoms**: Tenant sees another tenant's data, cross-tenant data access succeeds.

**THIS IS SEV-1 — IMMEDIATE ACTION REQUIRED**

**Procedure**:
1. **Immediately**: Disable the affected endpoint or feature
2. Assess scope: which tenants are affected, what data was exposed
3. Review query — identify missing `companyId` filter
4. Fix the query and deploy hotfix
5. Audit access logs to determine if data was actually viewed
6. Legal/compliance notification may be required
7. Notify affected tenants per data breach protocol
8. Conduct full security audit of similar endpoints

**Prevention**: Automated tenant isolation tests in CI. Code review requirement for all data access queries. Middleware-level `companyId` enforcement where possible.

### 5. Payment/Billing System Failure

**Symptoms**: Payments not recording, invoices incorrect, subscriptions not updating.

**Procedure**:
1. Determine if this is a data issue or system issue
2. If system issue (API errors):
   - Check database connectivity
   - Review application logs
   - Restart application if transient error
3. If data issue (incorrect amounts):
   - Identify affected invoices/payments
   - Void incorrect invoices
   - Create corrected invoices
   - Notify affected tenants
4. For SaaS billing (platform-level):
   - Do not auto-suspend tenants during billing outage
   - Manually extend grace period if needed

**Prevention**: Idempotent payment operations. Invoice validation before sending. Audit trail for all billing changes.

---

## Communication Templates

### Internal Status Update (for team)
```
INCIDENT: [SEV-X] [Brief description]
STATUS: [Investigating | Identified | Monitoring | Resolved]
TIME: [Timestamp]
IMPACT: [Who is affected and how]
CURRENT ACTIONS: [What we're doing right now]
NEXT UPDATE: [When the next update will be sent]
OWNER: [Name of incident commander]
```

### Tenant-Facing Notice (for affected customers)
```
Subject: Service Update — [Brief description]

We are currently experiencing [brief, non-technical description of the issue].

Impact: [What you may notice — e.g., "You may be unable to create new rentals temporarily."]

Our team is actively working to resolve this. We expect service to be restored by [estimated time or "within the next X hours"].

We apologize for any inconvenience. No action is required on your part at this time.

If you have urgent needs, please contact us at [support email/phone].

— [Platform Name] Team
```

### Recovery Notice (when resolved)
```
Subject: Service Restored — [Brief description]

The issue reported earlier has been resolved as of [timestamp].

What happened: [Brief, non-technical explanation]
Duration: [Start time] to [End time]
Data impact: [None / Details of any data impact]

All services are operating normally. If you experience any remaining issues, please contact us at [support email/phone].

Thank you for your patience.

— [Platform Name] Team
```

---

## Incident Response Checklist

### During Incident
- [ ] Severity level determined
- [ ] Incident commander assigned
- [ ] First internal status update sent
- [ ] Tenant-facing communication sent (if SEV-1 or SEV-2)
- [ ] Root cause identified
- [ ] Fix implemented and tested
- [ ] Fix deployed
- [ ] Verification completed
- [ ] Recovery notice sent

### Post-Incident (within 48 hours)
- [ ] Timeline of events documented
- [ ] Root cause analysis written
- [ ] Preventive measures identified
- [ ] Action items assigned with deadlines
- [ ] Incident report filed in shared documentation
- [ ] Process improvements implemented
