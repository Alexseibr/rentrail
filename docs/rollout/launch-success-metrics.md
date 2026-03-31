# Launch Success Metrics

## Key Performance Indicators (KPIs)

### Onboarding Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first rental | < 2 hours | From company creation to first completed rental |
| Onboarding completion rate | > 90% | Companies that complete all 10 onboarding steps |
| Staff activation rate | > 95% | Staff accounts that log in within 48 hours of creation |
| Asset import success rate | > 95% | Rows successfully imported vs. total rows |
| Onboarding support tickets | < 3 per tenant | Tickets during first week of onboarding |

### Operational Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily active users (staff) | > 80% of registered staff | Staff logging in per business day |
| Rental completion rate | > 90% | Rentals that reach `completed` vs. total created (excl. drafts) |
| Average rental creation time | < 3 minutes | From "New Rental" click to confirmed active rental |
| Asset utilization rate | > 40% | Assets in `rented` status / total `available` + `rented` assets |
| Deposit collection rate | 100% | Deposits recorded vs. rentals requiring deposits |

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Platform uptime | > 99.5% | Health endpoint availability per month |
| API response time (p95) | < 500ms | 95th percentile of all API requests |
| Login success rate | > 99% | Successful logins / total login attempts |
| Error rate | < 0.1% | 5xx responses / total API requests |
| Database query latency (p95) | < 100ms | 95th percentile of DB queries |

### Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Monthly recurring revenue (MRR) | Growing month-over-month | Sum of active subscription prices |
| Payment success rate | > 95% | Invoices paid on time / total invoices issued |
| Tenant churn rate | < 5% monthly | Tenants canceling / total active tenants |
| Support ticket volume | < 0.5 per tenant per week | Total tickets / active tenants / weeks |
| Net Promoter Score (NPS) | > 40 | Monthly survey of active tenants |

---

## 30-Day Post-Launch Success Criteria

### Phase 0 (Internal Alpha) — 30-Day Review

| Criteria | Status |
|----------|--------|
| Tenant #1 completing daily operations without manual DB interventions | |
| 50+ rental cycles completed without data issues | |
| All asset status transitions tested in production | |
| Blacklist enforcement verified working | |
| No SEV-1 incidents in past 14 days | |
| No unresolved SEV-2 incidents | |
| Staff feedback: average satisfaction > 7/10 | |
| Deposit workflow (hold → release) validated on real transactions | |
| Backup restore tested successfully | |
| Ready to onboard first external tenant | |

### Phase 1 (Controlled Beta) — 30-Day Review

| Criteria | Status |
|----------|--------|
| 2+ external tenants actively using the platform | |
| Each tenant completed 20+ rentals | |
| No tenant isolation violations | |
| Billing cycle tested (subscription → invoice → payment) | |
| Average onboarding time < 2 hours | |
| Support resolution time < 4 hours average | |
| No data loss or corruption incidents | |
| External tenants' satisfaction > 7/10 | |
| Ready to accept paying customers | |

### Phase 2 (Paid Pilot) — 30-Day Review

| Criteria | Status |
|----------|--------|
| 5+ paying tenants | |
| MRR tracking accurate vs. subscription records | |
| Average onboarding time < 1 hour | |
| Tenant churn rate < 10% | |
| Support ticket volume manageable by 1–2 staff | |
| API p95 < 500ms under pilot load | |
| 80%+ of pilot tenants active weekly | |
| Ready for public launch | |

---

## Measurement Tools

| Metric Category | Data Source |
|----------------|------------|
| Onboarding timing | Platform audit logs (timestamps of key actions) |
| Rental metrics | Database queries on rentals table |
| Asset utilization | Database queries on assets table (status distribution) |
| API performance | Application logs (response time tracking) |
| Uptime | External health check monitoring |
| Support tickets | Support ticket system |
| Revenue | SaaS subscriptions and invoices tables |
| Satisfaction | Manual surveys (email or in-app) |

## Reporting Cadence

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily operational dashboard | Daily | Operations team |
| Weekly metrics summary | Weekly | Founding team |
| Monthly business review | Monthly | Leadership |
| Tenant health report | Monthly | Per-tenant (shared with them) |
