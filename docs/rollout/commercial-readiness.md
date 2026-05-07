# Commercial Readiness

## Pricing Strategy

### Plan Tiers

| Plan       | Monthly Price  | Assets    | Branches  | Users     | Features                             |
| ---------- | -------------- | --------- | --------- | --------- | ------------------------------------ |
| Trial      | Free (14 days) | 10        | 1         | 3         | Core modules                         |
| Starter    | $49/mo         | 25        | 1         | 5         | Core + blacklist                     |
| Growth     | $149/mo        | 100       | 3         | 15        | All modules                          |
| Enterprise | Custom         | Unlimited | Unlimited | Unlimited | All + white-label + priority support |

### Plan Limits Enforcement

- Asset creation blocked when limit reached (returns 403 with clear error)
- Branch creation blocked when limit reached
- User invitation blocked when limit reached
- Upgrade prompt shown in admin UI when approaching limits (80%+)

---

## Trial Policy

- **Duration**: 14 days from subscription creation
- **Features**: Full access to core modules (assets, rentals, clients, payments, deposits)
- **Limits**: 10 assets, 1 branch, 3 staff users
- **Data**: Retained for 30 days after trial expiration
- **Conversion**: Upgrade to paid plan at any time during trial
- **Extension**: Platform admin can extend trial by updating `trialEndsAt`

### Trial Expiration Handling

1. Day 12: Email reminder — "Your trial ends in 2 days"
2. Day 14: Trial expires — dashboard shows upgrade prompt
3. Day 14+: Read-only access (can view data, cannot create rentals)
4. Day 44: Data deletion warning email
5. Day 45: Company status set to `canceled`, data queued for deletion

---

## Early-Adopter Policies (Phase 1–2)

### Beta Discount

- 50% off first 3 months for Phase 1 beta tenants
- 25% off first 3 months for Phase 2 pilot tenants
- Discount applied via coupon code in subscription

### Early-Adopter Benefits

- Direct access to founding team for support
- Feature request priority (within reason)
- Locked-in pricing for 12 months
- Public case study credit (optional)

### Early-Adopter Expectations

- Weekly 15-minute feedback call (first 4 weeks)
- Bug reports submitted via designated channel
- Tolerance for UI/UX improvements in progress
- Agreement to use latest version (auto-updated)

---

## Billing Operations

### Invoice Lifecycle

1. **Draft** → Invoice created but not finalized
2. **Issued** → Sent to tenant, payment expected
3. **Paid** → Payment received and recorded
4. **Void** → Canceled (e.g., billing error)
5. **Overdue** → Past due date, not paid

### Payment Collection

- Phase 1–2: Manual payment recording via platform admin
- Phase 3+: Integrate payment gateway (Stripe recommended)
- Invoice sent via email with payment instructions
- Past-due follow-up: Day 7, Day 14, Day 21 escalation

### Subscription Status Transitions

- `trial` → `active` (on plan upgrade)
- `active` → `past_due` (on payment failure/overdue)
- `past_due` → `active` (on payment received)
- `active` → `canceled` (on cancellation request)
- Any → `canceled` (on platform moderation)

---

## Contract & Terms

### Minimum Commitment

- No minimum commitment for monthly plans
- Annual plans: 12-month commitment with 10% discount
- Early termination: Remaining months billed at monthly rate

### Service Level (Informal, Phase 1–2)

- Target uptime: 99.5%
- Support response: < 4 hours during business hours
- No formal SLA until Phase 3 (public launch)

### Data Ownership

- Tenant owns all their operational data
- Data export available on request (CSV format)
- Data deleted 30 days after account cancellation
- Platform retains anonymized analytics data
