# Release Cadence

## Weekly Release Window

### Schedule

- **Release day**: Tuesday
- **Release time**: 10:00–12:00 UTC (low-traffic window)
- **Code freeze**: Monday 18:00 UTC (no new merges after this)
- **Staging deploy**: Monday (post-freeze) — final validation
- **Production deploy**: Tuesday 10:00 UTC
- **Post-deploy monitoring**: Tuesday 10:00–14:00 UTC (enhanced monitoring)

### Why Tuesday

- Avoids Monday (catch-up from weekend, incomplete prep)
- Avoids Friday (risk of weekend incidents without full staffing)
- Full week ahead for monitoring and issue resolution

### Release Process

1. **Monday AM**: Release candidate tagged from main branch
2. **Monday PM**: Deploy to staging, run full smoke test suite
3. **Monday EOD**: Code freeze — only hotfixes allowed after this
4. **Tuesday 10:00**: Deploy to production
5. **Tuesday 10:00–10:30**: Post-deploy verification:
   - [ ] Health endpoints returning 200
   - [ ] Login flow works
   - [ ] One test rental cycle on staging-like tenant
   - [ ] Dashboard loads with correct data
   - [ ] Mobile app connects and authenticates
6. **Tuesday 10:30**: Release announcement to team
7. **Tuesday 12:00**: If no issues — release confirmed stable

### Release Checklist

- [ ] All changes reviewed and approved
- [ ] TypeScript typecheck passes
- [ ] API tests pass (371+ tests)
- [ ] No known critical bugs
- [ ] Database migration plan reviewed (if schema changes)
- [ ] Pre-migration backup taken
- [ ] Staging deploy successful
- [ ] Staging smoke tests pass
- [ ] Release notes drafted
- [ ] Production deploy executed
- [ ] Post-deploy verification complete

---

## Hotfix Path

### When to Hotfix

- SEV-1 incident (platform down or data integrity issue)
- SEV-2 incident affecting all tenants with no workaround
- Security vulnerability with active exploitation risk

### Hotfix Process

1. **Branch**: Create hotfix branch from production tag
2. **Fix**: Minimal change to resolve the issue only
3. **Review**: Expedited review (single reviewer, focus on correctness)
4. **Test**: Run affected test suite (not full suite if time-critical)
5. **Deploy**: Direct to production (skip staging for SEV-1)
6. **Verify**: Post-deploy verification of the specific fix
7. **Merge back**: Cherry-pick fix into main branch
8. **Document**: Post-incident report within 24 hours

### Hotfix Rules

- Hotfixes contain ONLY the fix — no feature work bundled in
- All hotfixes require at least one code review
- All hotfixes require post-deploy verification
- If the fix is complex (> 50 lines changed), deploy to staging first unless SEV-1

---

## Mobile App Release Schedule

### Regular Releases

- **Frequency**: Bi-weekly (every other Tuesday, offset from backend releases)
- **Platform**: Expo managed workflow
- **OTA Updates**: Minor fixes via Expo Updates (no app store review needed)
- **Store Updates**: Monthly or as needed for native module changes

### Mobile Release Process

1. **Week 1, Monday**: Feature freeze for mobile release
2. **Week 1, Tuesday–Thursday**: QA testing on physical devices
3. **Week 1, Friday**: Build release candidate
4. **Week 2, Monday**: Submit to app stores (if store update needed)
5. **Week 2, Tuesday**: Push OTA update for non-store changes
6. **Week 2, Wednesday–Thursday**: Monitor crash reports and feedback

### OTA vs. Store Update Decision

| Change Type                  | OTA Update | Store Update |
| ---------------------------- | ---------- | ------------ |
| Bug fix (JS only)            | Yes        | No           |
| UI improvement               | Yes        | No           |
| New screen/feature (JS only) | Yes        | No           |
| New native module            | No         | Yes          |
| Permission change            | No         | Yes          |
| Expo SDK upgrade             | No         | Yes          |

---

## Database Migration Signoff

### Migration Categories

#### Non-Breaking (Auto-Approved)

- Adding new tables
- Adding nullable columns to existing tables
- Adding indexes
- Adding new enum values (append only)

#### Review Required

- Adding non-nullable columns (requires default or backfill plan)
- Modifying column types (must be compatible cast)
- Adding constraints (unique, check, foreign key)
- Removing indexes (verify no performance regression)

#### Signoff Required (Two Reviewers)

- Dropping columns (data loss risk)
- Dropping tables (data loss risk)
- Renaming columns/tables (breaks existing queries)
- Modifying primary keys (never do this)
- Removing enum values (breaks existing data)

### Migration Deployment Steps

1. Write migration/schema change
2. Test on local database
3. Test on staging database
4. Review migration category and get appropriate approval
5. Take production database backup
6. Deploy migration during release window
7. Verify application works with new schema
8. Keep backup for 7 days minimum

### Rollback Policy

- Non-breaking migrations: No rollback needed (additive only)
- Review-required migrations: Prepare rollback SQL before deploying
- Signoff-required migrations: Full rollback plan documented and tested on staging before production deployment

---

## Version Numbering

### Format: `YYYY.WW.P`

- `YYYY`: Year (2026)
- `WW`: ISO week number (01–52)
- `P`: Patch number within the week (0 = regular release, 1+ = hotfixes)

### Examples

- `2026.14.0` — Regular release, week 14 of 2026
- `2026.14.1` — First hotfix during week 14
- `2026.14.2` — Second hotfix during week 14
- `2026.15.0` — Next regular release

### Tagging

```bash
git tag -a v2026.14.0 -m "Release 2026.14.0"
git push origin v2026.14.0
```
