# Tenant #1 Internal Launch Plan

## Overview

Tenant #1 is the platform operator's own vehicle rental business. This launch validates all production workflows with real data and real operations before onboarding external tenants.

---

## Limited Live Scope

### Company Setup

- **Company Name**: [Your Business Name]
- **Slug**: [your-slug]
- **Country**: [Country code]
- **Currency**: [Currency code]
- **Timezone**: [Timezone]
- **Status**: `active`

### Branch Configuration

Start with a single branch to limit operational complexity:

| Branch      | Location        | Staff     | Assets         |
| ----------- | --------------- | --------- | -------------- |
| Main Branch | [City, Address] | 3–5 staff | 10–20 vehicles |

Expand to additional branches only after 2 weeks of stable operations.

### Station Setup

- 1 hub station (main office / storage location)
- 2–3 pickup points (high-traffic locations)
- 1 service center (maintenance area)

### Staff Accounts

| Role     | Count | Responsibilities                          |
| -------- | ----- | ----------------------------------------- |
| Owner    | 1     | Full access, company settings, billing    |
| Admin    | 1     | Staff management, reports, all operations |
| Operator | 2–3   | Daily rentals, client management          |
| Mechanic | 1     | Maintenance orders, asset health          |

### Asset Fleet

Start with a mixed fleet of 10–20 vehicles:

| Asset Type | Count | Notes             |
| ---------- | ----- | ----------------- |
| Bikes      | 5–8   | Standard bicycles |
| E-bikes    | 3–5   | Electric assist   |
| Scooters   | 2–4   | Kick scooters     |
| E-scooters | 2–3   | Electric scooters |

### Enabled Modules

- Asset management (required)
- Rental management (required)
- Client management (required)
- Payments and deposits (required)
- Blacklist (recommended)
- Notifications (recommended)
- Maintenance orders (recommended)
- IoT/Telemetry (optional — enable if devices available)

---

## Data Import Steps

### Step 1: Company & Branch Setup (Platform Admin)

1. Create company via platform admin
2. Set plan (or assign trial/internal plan)
3. Create branch(es) via company admin
4. Create stations under each branch

### Step 2: Staff Import

1. Create user accounts via admin panel or API
2. Assign company memberships with appropriate roles
3. Assign branch memberships for branch-scoped roles
4. Verify login for each staff member

### Step 3: Asset Import

1. Prepare asset CSV with required fields:
   - `assetType`, `brand`, `model`, `serialNumber`, `internalCode`
   - `branchId`, `stationId` (use IDs from step 1)
2. Import via admin panel or API batch endpoint
3. Verify asset count matches source data
4. Set initial status for each asset (`available`, `draft`, etc.)

### Step 4: Client Import (if existing customer base)

1. Prepare client CSV: `fullName`, `phone`, `email`, `documentType`, `documentNumber`
2. Normalize phone numbers to E.164 format
3. Import via API, check for duplicates
4. Verify client count

### Step 5: Rental Plans & Pricing

1. Create rental plans per asset type (hourly, daily, weekly, monthly)
2. Set prices and deposit amounts
3. Verify plans appear on public page (if enabled)

---

## Fallback Processes

If the platform experiences issues during Tenant #1 launch:

| Scenario                | Fallback                                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| Login fails             | Use direct database session reset; notify team                          |
| Rental creation fails   | Record rental manually in spreadsheet; enter into system post-fix       |
| Payment recording fails | Record payment in accounting tool; reconcile later                      |
| Asset status stuck      | Update via platform admin or direct API call                            |
| Database connectivity   | Restart application; check connection pool; restore from backup         |
| Data corruption         | Stop operations; restore from most recent backup; replay missed entries |

### Manual Override Access

- Platform super-admin retains direct database query access for emergencies
- All manual interventions must be logged in a shared incident log
- Post-incident: enter any offline data back into the system within 24 hours

---

## Success Metrics

### Week 1 Targets

- [ ] All staff accounts created and logged in successfully
- [ ] 10+ assets registered with correct branch/station assignment
- [ ] 5+ rental cycles completed end-to-end (draft → active → completed)
- [ ] 3+ payments recorded and linked to rentals
- [ ] 1+ deposit hold → release cycle completed
- [ ] No data loss or corruption

### Week 2 Targets

- [ ] 25+ total completed rentals
- [ ] All asset status transitions tested (available → rented → maintenance → available)
- [ ] Blacklist entry created and enforcement verified
- [ ] Incident report filed and resolved
- [ ] Staff comfortable with mobile app workflows
- [ ] Average rental creation time < 3 minutes

### Week 3 Targets (Readiness for Phase 1)

- [ ] 50+ total completed rentals
- [ ] No SEV-1 or unresolved SEV-2 incidents in past 7 days
- [ ] Onboarding process documented based on Tenant #1 experience
- [ ] Critical UX issues from staff feedback resolved
- [ ] Platform admin monitoring dashboard reviewed daily
- [ ] Confidence to onboard external tenant
