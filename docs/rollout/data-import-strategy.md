# Data Migration & Import Strategy

## Overview

This document defines the strategy for importing existing business data into the platform. Import is done per-tenant during onboarding, not as a one-time global migration.

---

## Importable Entity Types

| Entity | Priority | Import Method | Dependencies |
|--------|----------|---------------|--------------|
| Companies | P0 | Platform admin UI | None |
| Branches | P0 | Admin UI or API | Company |
| Stations | P0 | Admin UI or API | Company, Branch |
| Users/Staff | P0 | Admin UI or API | Company |
| Assets | P0 | CSV import | Company, Branch, Station |
| Clients | P1 | CSV import | Company |
| Rental Plans | P0 | Admin UI | Company |
| Blacklist Entries | P2 | CSV import | Company, Client |
| Devices | P2 | CSV import | Company |
| Batteries | P2 | CSV import | Company |

---

## CSV Template Definitions

### Assets Template (`assets-import.csv`)

| Column | Type | Required | Validation |
|--------|------|----------|------------|
| `assetType` | enum | Yes | `bike`, `ebike`, `scooter`, `escooter` |
| `brand` | string | Yes | Max 255 chars |
| `model` | string | Yes | Max 255 chars |
| `serialNumber` | string | Yes | Unique within company |
| `internalCode` | string | No | Unique within company |
| `qrCode` | string | No | Unique within company |
| `branchName` | string | Yes | Must match existing branch |
| `stationName` | string | No | Must match existing station in branch |
| `status` | enum | No | Default: `draft`. Options: `draft`, `available` |
| `purchasePrice` | decimal | No | Positive number |
| `isPublic` | boolean | No | Default: `false` |
| `notes` | string | No | Max 1000 chars |

### Clients Template (`clients-import.csv`)

| Column | Type | Required | Validation |
|--------|------|----------|------------|
| `fullName` | string | Yes | Min 2 chars, max 255 |
| `phone` | string | Yes | Will be normalized to E.164 |
| `email` | string | No | Valid email format |
| `documentType` | enum | No | `passport`, `id_card`, `drivers_license` |
| `documentNumber` | string | No | Max 100 chars |
| `address` | string | No | Max 500 chars |
| `notes` | string | No | Max 1000 chars |

### Blacklist Template (`blacklist-import.csv`)

| Column | Type | Required | Validation |
|--------|------|----------|------------|
| `clientPhone` | string | Yes | Used to match existing client |
| `scopeType` | enum | Yes | `company`, `branch`, `global` |
| `branchName` | string | Conditional | Required if scopeType = `branch` |
| `actionType` | enum | Yes | See action types below |
| `reasonCode` | string | Yes | Max 100 chars |
| `reasonText` | string | No | Max 1000 chars |
| `startsAt` | date | No | Default: now. ISO 8601 |
| `endsAt` | date | No | Null = permanent |

Action types: `warning`, `manual_approval_only`, `increased_deposit`, `restricted_access`, `blocked_branch`, `blocked_company`, `blocked_global`

### Devices Template (`devices-import.csv`)

| Column | Type | Required | Validation |
|--------|------|----------|------------|
| `serialNumber` | string | Yes | Unique within company |
| `deviceType` | enum | Yes | `gps_tracker`, `smart_lock`, `battery_bms`, `controller` |
| `manufacturer` | string | No | Max 255 chars |
| `model` | string | No | Max 255 chars |
| `firmwareVersion` | string | No | Max 50 chars |
| `assetInternalCode` | string | No | Links device to existing asset |

---

## Validation Rules

### General Rules
1. CSV must be UTF-8 encoded
2. First row must be column headers matching template exactly
3. Empty rows are skipped
4. Maximum 1,000 rows per import batch
5. All string fields are trimmed of leading/trailing whitespace

### Phone Normalization
- Strip all non-digit characters except leading `+`
- Prepend country code if missing (based on company's country setting)
- Validate format matches E.164 pattern: `+[1-15 digits]`
- Reject if number is clearly invalid (too short/long)

### Deduplication Rules

| Entity | Unique Key | On Duplicate |
|--------|-----------|--------------|
| Assets | `serialNumber` per company | Skip and report |
| Clients | `phone` per company | Skip and report |
| Devices | `serialNumber` per company | Skip and report |
| Blacklist | `clientId` + `scopeType` + `branchId` | Update existing |

### Reference Resolution
- `branchName` → Look up by name within the tenant's company. Fail if not found.
- `stationName` → Look up by name within the matched branch. Fail if not found.
- `assetInternalCode` → Look up by `internalCode` within company. Fail if not found.
- `clientPhone` → Look up by normalized phone within company. Fail if not found.

---

## Import Failure Reporting

Each import run produces a result report:

```json
{
  "importId": "uuid",
  "entity": "assets",
  "timestamp": "2026-03-31T12:00:00Z",
  "totalRows": 150,
  "successCount": 142,
  "skipCount": 5,
  "errorCount": 3,
  "errors": [
    {
      "row": 45,
      "field": "serialNumber",
      "value": "",
      "error": "Required field is empty"
    },
    {
      "row": 89,
      "field": "assetType",
      "value": "motorcycle",
      "error": "Invalid enum value. Expected: bike, ebike, scooter, escooter"
    },
    {
      "row": 122,
      "field": "branchName",
      "value": "West Side",
      "error": "Branch not found in company"
    }
  ],
  "skipped": [
    {
      "row": 12,
      "reason": "Duplicate serialNumber: SN-10045 (existing asset ID: abc-123)"
    }
  ]
}
```

### Error Handling Policy
- **Partial success**: Valid rows are imported; invalid rows are skipped
- **No rollback on partial failure**: Successfully imported rows remain
- **Error report**: Always generated, even for 100% success
- **Re-import safe**: Duplicate detection prevents double-entry on retry

---

## Tenant #1 Pilot Migration Plan

### Preparation (Day 1)
1. Export existing asset inventory to CSV from current system/spreadsheet
2. Export client list to CSV
3. Verify data completeness and format against templates
4. Create company, branches, and stations via platform admin

### Import Execution (Day 2)
1. Import assets CSV — verify count matches
2. Import clients CSV — verify count matches
3. Create rental plans via admin UI
4. Manually create 1–2 test rentals to verify workflow

### Validation (Day 2–3)
1. Compare imported asset count vs. source count
2. Spot-check 10 random assets for correct branch/station assignment
3. Spot-check 10 random clients for correct phone/email
4. Verify no orphaned references (assets pointing to non-existent branches)

### Reconciliation Checklist
- [ ] Total assets imported matches source count
- [ ] Total clients imported matches source count
- [ ] All branches have at least 1 asset assigned
- [ ] No duplicate serial numbers in the system
- [ ] Phone numbers properly normalized
- [ ] Import error report reviewed and all errors resolved or accepted
- [ ] Staff can search and find imported assets/clients
