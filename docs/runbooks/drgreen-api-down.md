# Runbook — Dr Green API Down

> **Severity:** Sev-2 (consultation submit + KYC verification degraded).
> **Architecture reference:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — Dr Green is the external prescription/fulfilment API (ECDSA secp256k1 signing, `lib/drgreen-api-client.ts`); consultation submit (`app/api/consultation/submit/route.ts`) and KYC check (`app/actions/kyc-check.ts`) depend on it.
> **Related:** [`incident-response.md`](./incident-response.md).

---

## 1. Symptoms

- Consultation submissions return the user-facing "Registration failed" message; `submissionError` rows accumulate in `consultation_questionnaires`.
- KYC status checks return `status: "API_ERROR"` (`app/actions/kyc-check.ts`).
- Logs: `[Consultation] Dr Green API error` / `[KYC] check failed` (redacted — no PHI).

> Dr Green latency is **upstream** and excluded from our latency SLO ([`SLO.md`](../SLO.md)); its availability is tracked separately.

## 2. Blast radius

- **New patients** can't complete registration (the local questionnaire row IS saved — submit retries to Dr Green later).
- **Existing patients'** KYC re-checks fail, but a locally-cached `isKycVerified` row is trusted first (`kyc-check.ts` checks the DB before calling the API), so already-verified patients keep checkout access.

## 3. Diagnose

```bash
# Are credentials configured at all? (health reports config presence, not liveness)
curl -s -H "Authorization: Bearer $HEALTH_DETAIL_TOKEN" https://<host>/api/health | jq '.services.drgreen'

# Probe the upstream directly (use a NON-production / synthetic client if you must POST):
#   GET <DRGREEN_API_URL>/health  (or the documented status path)
```

Distinguish:
- **Upstream outage** (their side) → wait + comms; nothing to deploy.
- **Auth/signing failure** (our side) → ECDSA key / `apiKey`/`secretKey` misconfig per tenant; check `getTenantDrGreenConfig`.
- **Our egress blocked** → Railway networking / DNS.

## 4. Mitigate / recover

1. **Confirm scope:** one tenant (per-tenant creds) vs all tenants (platform creds / upstream).
2. If **upstream**: post a status-page incident; verified patients are unaffected; new registrations are queued locally and can be re-submitted.
3. If **our creds/signing**: restore the correct `apiKey`/`secretKey`/signing key for the affected tenant(s); redeploy if env-sourced.
4. **Re-submit** failed registrations once healthy: the questionnaire rows with `submittedToDrGreen = false` are the backlog.

## 5. Exit criteria

- A synthetic consultation submit succeeds end-to-end and returns a `drGreenClientId`.
- `status: "API_ERROR"` rate returns to baseline.
- Backlog of `submittedToDrGreen = false` rows drained or scheduled.

## 6. Data-protection note

Never paste a raw Dr Green response into an incident doc — it carries special-category medical/KYC data. The logger already logs only a **redacted summary** (status + presence flags); rely on the `correlationId` for lookup (see [`incident-response.md`](./incident-response.md)).
