# Phased Rollout Plan

## Overview

The SaaS vehicle rental platform launches through four incremental phases, each with explicit entry criteria, exit criteria, and risk boundaries. The goal is to validate the system under increasing load and tenant diversity before opening to the public.

---

## Phase 0 — Internal Alpha (Weeks 1–3)

### Objective
Run Tenant #1 (own business) as a real production user to validate all core workflows end-to-end.

### Entry Criteria
- All hard go-live gates passed (see `go-live-gates.md`)
- Production environment provisioned with database, storage, secrets, and domain
- RBAC roles and permissions seeded
- Super-admin account created with platform-admin access
- Tenant #1 company record created with branches, stations, and staff
- Health endpoints returning 200 on production
- Database backups running on schedule

### Scope
- Single company, 1–2 branches, limited asset fleet (10–20 vehicles)
- Staff accounts: owner, admin, 2–3 operators
- Core modules: rentals, assets, clients, payments, deposits
- Staff mobile app for daily operations
- Platform admin for monitoring

### Exit Criteria
- 50+ completed rental cycles without data issues
- No SEV-1 or unresolved SEV-2 incidents in final 7 days
- Deposit hold/release flow validated on real transactions
- Blacklist enforcement confirmed working
- Daily operations running without manual DB interventions
- Staff feedback collected and critical UX issues addressed

### Non-Goals
- Public-facing pages for external customers
- B2B features
- IoT/telemetry integration (can be enabled but not required)

---

## Phase 1 — Controlled Beta (Weeks 4–6)

### Objective
Onboard 1–3 external companies under close support to validate tenant isolation and multi-tenant operations.

### Entry Criteria
- Phase 0 exit criteria met
- Tenant onboarding checklist validated (see `tenant-onboarding-checklist.md`)
- Tenant isolation verified (data cannot leak between companies)
- Support communication channel established (email + chat)
- Billing plans configured (at least one free/trial plan)

### Scope
- 2–4 total companies (including Tenant #1)
- Each beta tenant gets 1 branch, 5–15 assets
- All core modules enabled
- White-label settings available but optional
- Platform admin monitoring all tenants

### Exit Criteria
- All beta tenants have completed 20+ rentals each
- No tenant isolation violations detected
- Billing cycle tested: subscription created, invoice generated, payment recorded
- Onboarding time per tenant < 2 hours (from signup to first rental)
- Support ticket resolution time < 4 hours average
- No SEV-1 incidents in final 14 days

---

## Phase 2 — Paid Pilot (Weeks 7–10)

### Objective
Onboard 5–10 paying customers to validate commercial viability, billing accuracy, and scalability.

### Entry Criteria
- Phase 1 exit criteria met
- Pricing tiers finalized and billing automation working
- Invoice generation and payment tracking validated
- Data import templates and process documented
- Known limitations document shared with pilot customers

### Scope
- 8–14 total companies
- Multiple asset types per tenant (bikes, ebikes, scooters, escooters)
- Multi-branch setups for larger tenants
- Full module access based on plan tier
- Public company pages enabled for tenants who request them

### Exit Criteria
- 80%+ of pilot tenants are actively using the platform weekly
- Monthly recurring revenue tracking accurate vs. subscription records
- Average onboarding time < 1 hour
- Support ticket volume manageable by 1–2 support staff
- Performance: API p95 < 500ms under pilot load
- No data loss or corruption incidents

---

## Phase 3 — Public Launch (Week 11+)

### Objective
Open self-service signup and marketing for general availability.

### Entry Criteria
- Phase 2 exit criteria met
- Self-service signup flow working (company creation → trial start)
- Automated billing (subscription lifecycle, invoice generation, payment reminders)
- Monitoring and alerting configured for production load
- Incident response playbook validated in practice
- Release cadence established (see `release-cadence.md`)

### Scope
- Unlimited tenant signup
- All plan tiers available
- Self-service onboarding with guided setup wizard
- Public marketing pages
- Full platform admin operations

### Success Markers (30-day post-launch)
- 20+ active tenants
- < 5% churn rate
- First-rental time under 30 minutes from account creation
- Support ticket ratio < 0.5 per tenant per week
- Zero SEV-1 incidents
- 99.5%+ uptime

---

## Timeline Summary

| Phase | Duration | Tenants | Focus |
|-------|----------|---------|-------|
| Phase 0: Internal Alpha | 3 weeks | 1 (own) | Core workflow validation |
| Phase 1: Controlled Beta | 3 weeks | 2–4 | Tenant isolation, onboarding |
| Phase 2: Paid Pilot | 4 weeks | 8–14 | Commercial viability |
| Phase 3: Public Launch | Ongoing | Unlimited | Growth and scaling |

## Non-Goals of Initial Launch

- Native mobile app for end customers (clients use web/public pages)
- Real-time GPS tracking map view (telemetry data is stored but visualization is post-launch)
- Automated fleet rebalancing or predictive maintenance
- Multi-currency billing (single currency per tenant, USD default)
- API access for tenants (internal API only)
- Marketplace or tenant discovery features
