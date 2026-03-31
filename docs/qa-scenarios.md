# QA Scenario Matrix

## Legend
- **P0**: Must pass before any release
- **P1**: Must pass before production release
- **P2**: Should pass, acceptable to defer

---

## 1. Authentication & Authorization

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| A1 | Register new user | P0 | POST /auth/register with valid data | 201, user created |
| A2 | Login with valid credentials | P0 | POST /auth/login | 200, access + refresh tokens |
| A3 | Login with wrong password | P0 | POST /auth/login wrong password | 401 |
| A4 | Access protected route without token | P0 | GET /assets no auth header | 401 |
| A5 | Access with expired token | P0 | Use expired JWT | 401 |
| A6 | Refresh tokens | P0 | POST /auth/refresh with valid refresh token | 200, new token pair |
| A7 | Refresh with used/invalid token | P1 | POST /auth/refresh with bad token | 401 |

## 2. Multi-Tenant Isolation

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| T1 | User A reads Company B assets | P0 | GET /assets with Company B header | 403 |
| T2 | User A mutates Company B rental | P0 | POST /rentals with Company B header | 403 |
| T3 | Branch-scoped user accesses foreign branch | P0 | GET /assets with foreign branch-id | 403 |
| T4 | Company admin accesses all branches | P0 | Admin reads assets from any branch | 200 |
| T5 | SuperAdmin accesses any company | P0 | SA reads Company A and B | 200 |
| T6 | Request missing x-company-id | P0 | GET /assets without header | 403 |
| T7 | Public slug doesn't leak private data | P1 | GET /public/companies/:slug | Only public fields |

## 3. Asset Management

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| AM1 | Create asset | P0 | POST /assets valid data | 201 |
| AM2 | Duplicate QR code rejected | P1 | POST /assets same qrCode | 409 |
| AM3 | Valid status transition | P0 | PATCH status draft→available | 200 |
| AM4 | Invalid status transition | P0 | PATCH status draft→rented | 422 |
| AM5 | Retired asset cannot transition | P0 | PATCH status retired→available | 422 |
| AM6 | Asset with wrong branch | P1 | POST /assets with foreign branch | 400 |

## 4. Rental Workflow

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| R1 | Create rental (happy path) | P0 | POST /rentals valid data | 201 |
| R2 | Approve rental | P0 | POST /rentals/:id/approve | 200 |
| R3 | Start rental | P0 | POST /rentals/:id/start | 200, asset→rented |
| R4 | Return rental | P0 | POST /rentals/:id/return | 200, asset→available |
| R5 | Cancel rental | P1 | POST /rentals/:id/cancel | 200 |
| R6 | Rent unavailable asset | P0 | POST /rentals with rented asset | 422 |
| R7 | Blacklisted client blocked | P0 | POST /rentals for blocked client | 422 |
| R8 | Invalid status transition | P0 | Try completed→active | 422 |
| R9 | Overdue detection | P1 | Rental past end date | Status shows overdue |

## 5. Blacklist

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| B1 | Create blacklist entry | P0 | POST /blacklist | 201 |
| B2 | Check returns blocking entries | P0 | POST /blacklist/check for blocked client | isBlacklisted: true |
| B3 | Expired entry not blocking | P1 | Check after entry.endsAt | isBlacklisted: false |
| B4 | Branch scope only blocks that branch | P1 | Check in different branch | isBlacklisted: false |
| B5 | Global scope blocks everywhere | P0 | Check in any company | isBlacklisted: true |

## 6. Payments & Deposits

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| P1 | Create payment | P0 | POST /payments | 201 |
| P2 | Mark payment paid | P0 | PATCH /payments/:id status→paid | 200 |
| P3 | Refund payment | P1 | POST /payments/:id/refund | 200 |
| P4 | Deposit hold | P0 | POST /deposits | 201, status=held |
| P5 | Deposit release | P0 | POST /deposits/:id/release | 200 |
| P6 | Deposit forfeit | P1 | POST /deposits/:id/forfeit | 200 |

## 7. Incidents & Maintenance

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| I1 | Create incident | P0 | POST /incidents | 201 |
| I2 | Resolve incident | P1 | PATCH /incidents/:id | 200 |
| M1 | Create maintenance order | P0 | POST /maintenance | 201 |
| M2 | Start maintenance | P1 | PATCH status→in_progress | 200 |
| M3 | Complete maintenance | P1 | PATCH status→completed | 200 |

## 8. Public Pages & Lead Intake

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| PUB1 | Load company public page | P0 | GET /public/companies/:slug | 200 |
| PUB2 | Disabled public page returns 404 | P1 | Company with publicPage disabled | 404 |
| PUB3 | Submit inquiry | P0 | POST /public/inquiries | 201 |
| PUB4 | Submit B2B request | P1 | POST /public/b2b-requests | 201 |
| PUB5 | Convert inquiry to client | P1 | POST /inquiries/:id/convert | 200 |

## 9. Telemetry & Devices

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| TEL1 | Ingest telemetry with valid API key | P0 | POST /telemetry/ingest | 200 |
| TEL2 | Ingest without API key rejected | P0 | POST /telemetry/ingest no key | 401 |
| TEL3 | Device resolves to company/asset | P1 | Ingest for bound device | Snapshot links company |
| DEV1 | Create device | P1 | POST /devices | 201 |
| BAT1 | Create battery | P1 | POST /batteries | 201 |

## 10. Mobile App Flows

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| MOB1 | Login on mobile | P0 | POST /auth/login from app | Token stored |
| MOB2 | Token refresh on mobile | P0 | Auto-refresh when expired | New token seamless |
| MOB3 | QR scan resolves asset | P1 | POST /scan/resolve with QR | Asset details |
| MOB4 | Offline queue enqueues action | P1 | Create incident while offline | Queued in AsyncStorage |
| MOB5 | Queue drains on reconnect | P1 | Go online | Pending items sync |
| MOB6 | Photo upload via presigned URL | P1 | Request URL, PUT to GCS | 200 |
| MOB7 | Push registration | P2 | Register expo push token | Stored in DB |

## 11. Role-Based Access

| # | Scenario | Priority | Steps | Expected |
|---|----------|----------|-------|----------|
| RBAC1 | Owner has full company access | P0 | Owner performs any company operation | 200 |
| RBAC2 | Viewer cannot create assets | P0 | Viewer POST /assets | 403 |
| RBAC3 | Operator can start rental | P0 | Operator POST /rentals/:id/start | 200 |
| RBAC4 | Operator cannot approve rental | P1 | Operator POST /rentals/:id/approve | 403 |
| RBAC5 | Mechanic can create maintenance | P1 | Mechanic POST /maintenance | 200 |
| RBAC6 | Accountant can view payments | P1 | Accountant GET /payments | 200 |

---

## Running the QA Pack

### Automated
```bash
pnpm test          # All test suites
pnpm test:unit     # Unit tests only
pnpm test:api      # API endpoint tests
```

### Manual Verification
1. Seed demo data: `pnpm seed:demo`
2. Login as each role at the Staff Portal
3. Walk through scenarios above
4. Check health: `GET /api/health/full`
