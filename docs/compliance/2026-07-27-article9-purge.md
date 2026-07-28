# Remediation Record — Article 9 Health Data Purge

**Date:** 2026-07-27
**Reference:** [prd-data-protection-remediation.md](../PRDS/prd-data-protection-remediation.md) (WS1)
**Migration:** `20260727000000_drop_article9_health_columns`
**Status:** ⏳ Awaiting execution — counts below are populated from the database after the migration runs.

---

## 1. Scope of the change

`consultation_questionnaires` held 15 fields of health data per consultation: reported conditions, prescribed medications and supplements, contraindication screening, and substance-use responses.

Technical review before the change established that nothing in the platform depended on them:

- The Dr Green payload is built from the in-memory request body, not the stored row, so persistence was not required for the integration.
- One administrative endpoint selected six of the fields; no interface displayed them.
- No retry or reconciliation process read them.

Dr Green is the controller for the clinical record. Applying data minimisation, BudStacks does not need a copy.

## 2. Position now implemented

Collect, validate, transmit to Dr Green, discard with the request. BudStacks retains no Article 9 special-category data.

## 3. What was done

| Change | Location |
|---|---|
| Removed the `medicalHistory` query and response field | `app/api/tenant-admin/customers/[id]/route.ts` |
| Stopped persisting the 15 health fields | `app/api/consultation/submit/route.ts` |
| Replaced raw upstream error persistence with a classification code | `app/api/consultation/submit/route.ts` |
| Single source of truth for the field set | `lib/security/article9.ts` |
| Folded the field set into log redaction | `lib/security/redact.ts` |
| Dropped 15 columns; recorded pre-drop counts | `prisma/migrations/20260727000000_drop_article9_health_columns` |
| Automated guard against reintroduction | `tests/unit/no-article9-persistence.test.ts` |

### Columns dropped

`medicalConditions`, `otherCondition`, `prescribedMedications`, `prescribedSupplements`, `hasHeartProblems`, `hasCancerTreatment`, `hasImmunosuppressants`, `hasLiverDisease`, `hasPsychiatricHistory`, `hasAlcoholAbuse`, `hasDrugServices`, `alcoholUnitsPerWeek`, `cannabisReducesMeds`, `cannabisFrequency`, `cannabisAmountPerDay`

### Related change

`submissionError` previously stored the upstream error message. Dr Green error bodies can echo submitted values, so it now stores a stable classification code (`PHONE_EXISTS (409)`, `BAD_REQUEST (400)`, …) instead. Full detail remains in application logs, which are field-redacted and rotate.

## 4. Counts

Captured by the migration into `compliance_purge_records` (id `article9-health-columns-2026-07-27`) **before** any column was dropped, so the record cannot be reconstructed after the fact.

To retrieve after execution:

```sql
SELECT "executedAt", "details"
FROM   "compliance_purge_records"
WHERE  "id" = 'article9-health-columns-2026-07-27';
```

| Metric | Staging | Production |
|---|---|---|
| `rowsTotal` | _pending_ | _pending_ |
| `rowsSubmittedToDrGreen` | _pending_ | _pending_ |
| `rowsNeverSubmittedToDrGreen` | _pending_ | _pending_ |
| `rowsCarryingHealthData` | _pending_ | _pending_ |
| Executed at | _pending_ | _pending_ |
| Migration commit SHA | _pending_ | _pending_ |

## 5. Accepted data loss

The migration is **irreversible**. Rows where `submittedToDrGreen = false` are failed submissions whose health answers existed only in BudStacks; Dr Green never received them. That data is destroyed and cannot be recovered.

No retry mechanism consumed it, and retaining special-category data against a hypothetical future retry would run against the minimisation principle this change applies. Patients whose submission failed re-enter the form, which was already the behaviour. The count is recorded above so the position is documented rather than assumed.

## 6. Backups

Backups taken before the migration still contain the dropped columns. They are **not** separately purged; they expire on the existing retention schedule.

| Item | Value |
|---|---|
| Backup provider | Railway-managed PostgreSQL |
| Retention window | _to confirm_ |
| Last backup containing Article 9 data | _pending — set at execution_ |
| Expiry date after which no copy remains | _pending_ |

**Action:** confirm the retention window and record the expiry date. Until that date, a restore would reintroduce the data; any restore performed before then must re-run this migration immediately afterwards.

## 7. Reintroduction guard

`tests/unit/no-article9-persistence.test.ts` runs in CI on every pull request and fails if:

- any health field is declared on the `consultation_questionnaires` schema model;
- any health field is assigned inside a Prisma write to that model anywhere in `app/` or `lib/`;
- any health field is missing from the log redactor's `SENSITIVE_FIELDS`;
- the consultation submit route no longer matches the scan, which would make a green result vacuous.

This matters because the Prisma client is typed as `any` in places — re-adding a health field to a write payload compiles cleanly, so the type system is not a guard. The test is.

## 8. Open items

1. **Dr Green's retention and deletion.** BudStacks no longer holds this data; Dr Green does, as controller. Whether they delete on request, and where their retention clock starts, is unconfirmed and outside our control. Raised as an open question in the PRD.
2. **Backup retention window** — §6 above.
3. Counts and SHAs to be filled in at execution.

---

*Internal remediation record. Retained as evidence of the minimisation review and the change made.*
