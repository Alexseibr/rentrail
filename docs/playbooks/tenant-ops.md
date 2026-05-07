# Tenant Operations Playbook

Workflows for day-to-day operations performed by tenant staff (operators, managers, admins).

---

## 1. Asset Management

### Create New Asset

1. Navigate to Assets → "Add Asset"
2. Fill required fields:
   - Asset type (bike, ebike, scooter, escooter)
   - Brand and model
   - Serial number (from manufacturer label)
   - Internal code (your fleet numbering)
   - Assign to branch and station
3. Set initial status to `draft`
4. Add photos if available
5. When ready for rentals: change status to `available`

### Asset Status Transitions

| From                          | To                                           | When |
| ----------------------------- | -------------------------------------------- | ---- |
| `draft` → `available`         | Asset inspected and ready for rental         |
| `available` → `rented`        | Rental started (automatic)                   |
| `rented` → `available`        | Rental completed, asset returned (automatic) |
| `available` → `maintenance`   | Scheduled maintenance or issue found         |
| `maintenance` → `available`   | Maintenance completed, asset cleared         |
| `available` → `blocked`       | Asset unsafe or under investigation          |
| `blocked` → `available`       | Issue resolved                               |
| Any → `lost`                  | Asset cannot be located                      |
| Any → `stolen`                | Theft confirmed                              |
| `lost`/`stolen` → `available` | Asset recovered                              |

### End-of-Day Asset Check

- [ ] Count physical assets at each station
- [ ] Compare with system count (Assets → filter by station)
- [ ] Flag any discrepancies:
  - Asset physically present but showing `rented` → check for unreturned rental
  - Asset missing but showing `available` → mark as `lost`, create incident
- [ ] Check assets in `maintenance` status → update if work completed
- [ ] Charge e-bikes/e-scooters as needed, update battery status

---

## 2. Client Management

### Register New Client

1. Navigate to Clients → "Add Client"
2. Collect and enter:
   - Full name
   - Phone number (required — system normalizes format)
   - Email (recommended)
   - Document type and number (ID verification)
3. Save — client is now `active` and can rent

### Client Verification

Before first rental, verify:

- [ ] ID document matches name provided
- [ ] Phone number is reachable (send verification SMS if available)
- [ ] Client is not on blacklist (system checks automatically)

### Handling Problem Clients

1. **Minor issue** (late return, minor damage):
   - Add blacklist entry with `warning` action type
   - Reason will show to staff on next rental attempt
2. **Moderate issue** (repeated lateness, significant damage):
   - Add blacklist entry with `increased_deposit` or `manual_approval_only`
   - Manager must approve future rentals
3. **Severe issue** (theft, violence, fraud):
   - Add blacklist entry with `blocked_company` or `blocked_global`
   - Client cannot rent from any branch
   - Create incident report

---

## 3. Rental Lifecycle

### Start a Rental

1. Navigate to Rentals → "New Rental"
2. Select or search for client (verify identity)
3. System checks blacklist — if flagged, follow action type guidance
4. Select available asset
5. Choose rental plan (hourly, daily, etc.)
6. Confirm deposit amount
7. Collect deposit payment → record as `held`
8. Confirm rental → status becomes `active`
9. Record pickup time and condition notes

### During Active Rental

- Monitor rental duration vs. plan end date
- If approaching end time: contact client with return reminder
- If overdue: system flags rental → follow overdue procedure

### Complete a Rental (Return)

1. Navigate to active rental
2. Inspect returned asset:
   - [ ] Physical condition matches checkout condition
   - [ ] Battery level acceptable (for electric vehicles)
   - [ ] No visible damage
3. Record return time and condition notes
4. Calculate final charge based on actual duration
5. Collect rental payment → record payment as `paid`
6. Release deposit:
   - No issues: release full deposit
   - Minor damage: partial forfeit → record forfeit amount
   - Major damage: full forfeit → create incident
7. Complete rental → asset returns to `available`

### Handle Overdue Rental

1. System flags rental as `overdue` when past end date
2. **Hour 1–4**: Send SMS/call to client requesting return
3. **Hour 4–12**: Escalate to manager, attempt all contact methods
4. **Hour 12–24**: Manager decision:
   - Extend rental (if client responsive): update end date
   - Mark as potential loss: create incident, notify owner
5. **24+ hours**: Consider `lost` or `stolen` asset status
6. Record all contact attempts in rental notes

### Handle Disputed Rental

1. If client disputes charges or damage assessment:
2. Change rental status to `disputed`
3. Document client's claim in notes
4. Review checkout/return condition photos
5. Manager decision:
   - Uphold charge: explain reasoning to client
   - Partial refund: adjust payment, record refund
   - Full reversal: void charges, release deposit
6. Update rental status to `completed` after resolution

---

## 4. Incident Handling

### Create Incident Report

1. Navigate to Incidents → "New Incident"
2. Select incident type:
   - `damage` — asset damaged during rental
   - `theft` — asset stolen
   - `accident` — client injury or third-party involvement
   - `vandalism` — deliberate damage
   - `mechanical_failure` — asset failure during use
   - `other` — anything not covered above
3. Link to relevant rental, asset, and/or client
4. Enter detailed description of what happened
5. Attach photos/evidence if available
6. Set initial status to `open`

### Incident Resolution Flow

1. **Open**: Incident reported, needs investigation
2. **Investigating**: Assigned to staff member, gathering information
3. **Pending Action**: Investigation complete, awaiting decision
4. **Resolved**: Action taken, incident closed
   - Record resolution notes
   - Update asset status if needed
   - Update client blacklist if needed
   - Record any financial adjustments

### Incident Escalation

- Minor (cosmetic damage): Operator resolves
- Moderate (functional damage, short-term loss): Manager resolves
- Major (theft, accident, legal issue): Owner/Admin resolves
- Emergency (client injury): Immediately contact emergency services, then report

---

## 5. Maintenance Workflows

### Scheduled Maintenance

1. Identify assets due for maintenance:
   - By mileage/usage count (if tracked)
   - By calendar schedule (e.g., monthly inspection)
   - By battery health threshold (for electric vehicles)
2. Change asset status to `maintenance`
3. Create maintenance order with:
   - Description of work needed
   - Priority (low, normal, high, urgent)
   - Assigned mechanic
4. Move asset to service center station

### Maintenance Completion

1. Mechanic completes work
2. Update maintenance order with:
   - Work performed
   - Parts used (if applicable)
   - Cost of maintenance
3. Close maintenance order
4. Change asset status back to `available`
5. Move asset to operational station

---

## 6. Blacklist Management

### Add Blacklist Entry

1. Navigate to Blacklist → "Add Entry"
2. Select client (search by name or phone)
3. Configure:
   - **Scope**: Company-wide or specific branch
   - **Action type**: warning → manual_approval_only → increased_deposit → blocked
   - **Reason code**: `late_return`, `property_damage`, `theft_attempt`, `fraud`, `violence`, `policy_violation`
   - **Reason text**: Detailed explanation (visible to staff)
   - **Duration**: Permanent (no end date) or temporary (set end date)
4. Save — effective immediately

### Remove/Modify Blacklist Entry

1. Navigate to client's blacklist entries
2. To soften: change action type (e.g., `blocked` → `warning`)
3. To expire: set end date to today
4. To remove: toggle entry to inactive
5. Document reason for change

---

## 7. End-of-Day Checklist

### Operator Closing Tasks

- [ ] All active rentals reviewed — follow up on any approaching end time
- [ ] All overdue rentals escalated per overdue procedure
- [ ] Asset count reconciliation (physical vs. system)
- [ ] E-vehicle charging initiated
- [ ] Cash/payment reconciliation (if applicable)
- [ ] Incidents from today documented
- [ ] Station areas tidied and secured

### Manager Daily Review

- [ ] Review day's rental volume and revenue
- [ ] Check for unresolved incidents
- [ ] Review overdue rentals and escalations
- [ ] Verify deposit holds match active rentals
- [ ] Check for pending client verifications
- [ ] Review staff notes and feedback
