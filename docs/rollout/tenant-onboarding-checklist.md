# Tenant Onboarding Checklist

## Overview

This is the repeatable 10-step checklist for onboarding each new tenant onto the platform. Target: complete onboarding in under 2 hours for a standard setup.

---

## Step 1: Tenant Qualification

- [ ] Business type confirmed (vehicle rental — bikes, ebikes, scooters, escooters)
- [ ] Operating country and currency identified
- [ ] Estimated fleet size captured (determines plan tier)
- [ ] Number of branches/locations identified
- [ ] Number of staff users estimated
- [ ] Billing contact and payment method confirmed
- [ ] Known limitations document shared (see `known-limitations.md`)
- [ ] Plan tier selected (trial / starter / growth / enterprise)

**Gate**: Tenant is a fit for the platform and has agreed to terms.

---

## Step 2: Company Setup

- [ ] Company created via platform admin with:
  - Name, slug (URL-safe identifier), legal name
  - Contact email and phone
  - Country, currency, timezone
- [ ] Plan assigned via "Set Plan" action
- [ ] Subscription created (trial or paid)
- [ ] Company status set to `active`

**Estimated time**: 5 minutes

---

## Step 3: Branch & Station Setup

- [ ] Primary branch created with name and location
- [ ] Hub station created (main office/storage)
- [ ] Pickup point stations created (2–5 typical locations)
- [ ] Service center station created (if applicable)
- [ ] Additional branches created (if multi-location)

**Estimated time**: 10–15 minutes

---

## Step 4: Staff Invitations

- [ ] Owner account created (business owner/primary admin)
- [ ] Admin account(s) created (daily management)
- [ ] Operator accounts created (front-line staff)
- [ ] Role assignments verified:
  - Owner → full company access
  - Admin → management access
  - Operator → branch-scoped operations
  - Mechanic → maintenance access (if applicable)
- [ ] Each staff member has logged in successfully
- [ ] Mobile app installed on operator devices

**Estimated time**: 10–20 minutes (varies by team size)

---

## Step 5: Asset Import

- [ ] Asset data prepared in CSV format (see `data-import-strategy.md`)
- [ ] Serial numbers unique and verified
- [ ] Assets assigned to correct branches and stations
- [ ] Import executed and result report reviewed
- [ ] All errors resolved or documented as accepted
- [ ] Asset count reconciled against source data
- [ ] QR codes generated/assigned (if using QR scanning)

**Estimated time**: 15–30 minutes

---

## Step 6: Tariff & Rental Plan Configuration

- [ ] Rental plans created for each asset type:
  - Hourly rate + deposit
  - Daily rate + deposit
  - Weekly/monthly rates (if applicable)
- [ ] Deposit amounts set per plan
- [ ] Plans verified on public company page (if public pages enabled)
- [ ] Staff trained on applying plans during rental creation

**Estimated time**: 10 minutes

---

## Step 7: Public Page Configuration (Optional)

- [ ] Company branding uploaded (logo, colors)
- [ ] White-label settings configured (if applicable):
  - Custom domain
  - Brand name
  - Theme colors
- [ ] Public company page tested: `/public/[slug]`
- [ ] Fleet availability shows correct asset counts
- [ ] Inquiry form submits correctly

**Estimated time**: 10–15 minutes (if applicable)

---

## Step 8: Blacklist Configuration

- [ ] Import existing blacklist data (if migrating from another system)
- [ ] Review blacklist action types with tenant:
  - `warning` — alert only
  - `manual_approval_only` — requires manager approval
  - `increased_deposit` — higher deposit required
  - `blocked_branch` / `blocked_company` — rental denied
- [ ] Test blacklist enforcement: create entry → attempt rental → verify block
- [ ] Staff trained on adding/removing blacklist entries

**Estimated time**: 5–10 minutes

---

## Step 9: Staff Training

- [ ] Walk through core rental lifecycle:
  1. Create rental (select client, asset, plan)
  2. Start rental (record pickup)
  3. Complete rental (record return, collect payment)
  4. Handle overdue rental
- [ ] Demonstrate asset status management:
  - Mark as maintenance, available, blocked
- [ ] Show client management:
  - Create client, search, view history
- [ ] Cover incident reporting flow
- [ ] Show deposit hold/release/forfeit process
- [ ] Mobile app orientation:
  - Login, view dashboard, manage rentals

**Estimated time**: 30–45 minutes

---

## Step 10: Soft Launch & First-Week Support

### Day 1: Soft Launch

- [ ] First real rental created in production
- [ ] Payment recorded successfully
- [ ] End-of-day check completed (all assets accounted for)

### Days 2–5: Active Monitoring

- [ ] Daily check-in with tenant (15-min call or chat)
- [ ] Monitor for:
  - Login issues
  - Workflow confusion
  - Data discrepancies
  - Performance problems
- [ ] Collect feedback on UX and workflow gaps
- [ ] Resolve any blocking issues within 4 hours

### Day 7: First-Week Review

- [ ] Review key metrics:
  - Total rentals completed
  - Average rental creation time
  - Any failed/abandoned workflows
  - Support requests received
- [ ] Confirm tenant is self-sufficient for daily operations
- [ ] Transition to standard support cadence (see `support-model.md`)
- [ ] Collect NPS/satisfaction score

---

## Onboarding Completion Criteria

| Metric                               | Target                             |
| ------------------------------------ | ---------------------------------- |
| Time to first rental                 | < 2 hours from start of onboarding |
| All staff logged in                  | 100%                               |
| Assets imported and verified         | 100% match                         |
| At least 5 rentals completed         | Yes                                |
| Tenant self-sufficient for daily ops | Confirmed                          |
| No unresolved blockers               | Confirmed                          |
