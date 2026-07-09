# PRD-302: Super-Admin Impersonation (Support Access)

**Status:** Spec Complete  
**Priority:** P1 (day-1 for support team)  
**Effort:** 2-3 sprint weeks  
**Owner:** Opus  

---

## Executive Summary

Allow super-admins (support team) to temporarily log in as a tenant, see/do everything they can do, and return to their own account. Full audit trail required for compliance.

**Why:** Customer calls with "I can't see my orders"—support needs to log in, reproduce, and fix on their behalf. Must be auditable for GDPR/compliance.

---

## Current State

- Super-admins have access to all tenant-admin routes (via role check in layout.tsx)
- No temporary impersonation session
- No visibility into which tenant they're viewing
- No audit trail of impersonation

---

## Phase 1: Impersonation Flow

### AC-1: Super-Admin Impersonation Dashboard

**UI: `/super-admin/impersonation` (new page)**

**Layout:**
- Header: "Impersonation Sessions"
- Search/filter: by tenant name, email, or ID
- Trigger button: "Impersonate Tenant"
- Table of active/past sessions (see AC-3)

**Impersonate Tenant Flow:**
1. Search box: type tenant name/email → autocomplete search via GET `/api/super-admin/tenants/search`
2. Click result → modal confirmation: "You will log in as [Tenant Name]. Continue?"
3. Click "Impersonate" → backend creates session, returns redirect URL
4. Super-admin is logged in as that tenant
5. Banner at top (see AC-2)
6. After fixing issue, click "Exit Impersonation" → return to super-admin session

### AC-2: Impersonation Session Header

**Visual Indicator (all pages while impersonating):**

At the very top of app (above navbar), show a persistent **red/orange banner**:
```
⚠️ YOU ARE LOGGED IN AS: [Tenant Name] ([Tenant Email])
Super-Admin: [Your Name] | Session ID: abc123 | Elapsed: 15m 32s
[Exit Impersonation] [View Audit Log for this Session]
```

**Behavior:**
- Always visible (cannot be dismissed)
- Shows elapsed time (auto-updates every 10 seconds)
- Red background so super-admin never forgets they're impersonating
- Clicking tenant name shows tenant details (business name, address, plan, etc.)

### AC-3: Impersonation Session Table

**Show on `/super-admin/impersonation`:**

| Tenant | Super-Admin | Start Time | Duration | Status | IP | Actions |
|--------|-------------|-----------|----------|--------|----|---------| 
| Herb Co | Gerard K. | 2:45 PM | 12m 30s | Active | 192.168.1.1 | End / View Log |
| Green Store | Gerard K. | Yesterday | 8m | Completed | 192.168.1.1 | View Log / Download |

**Status:** "Active" (ongoing), "Completed" (ended)  
**Actions:** "End Session" / "View Audit Log"

**Persistence:**
- Keep last 90 days of impersonation sessions
- Show in super-admin dashboard (read-only)
- Do NOT show to tenants (they should never see impersonation happened)

### AC-4: Technical Implementation (Session Isolation)

**New Table: `impersonation_sessions`**

```sql
CREATE TABLE impersonation_sessions (
  id UUID PRIMARY KEY,
  superAdminClerkId TEXT NOT NULL, -- Clerk user ID of support person
  superAdminEmail TEXT NOT NULL,
  tenantId UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenantEmail TEXT NOT NULL,
  impersonationToken TEXT UNIQUE NOT NULL, -- Bearer token for this session
  startedAt TIMESTAMP DEFAULT NOW(),
  endedAt TIMESTAMP,
  endedReason TEXT, -- 'manual', 'timeout', 'session_expired'
  superAdminIpAddress TEXT,
  notes TEXT, -- optional: why support logged in (for support team to document)
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(superAdminClerkId, tenantId) -- only one active session per super-admin per tenant
};
```

**Session Flow:**

1. **Request Impersonation:**
   - Super-admin visits `/super-admin/impersonation/start?tenantId=xyz`
   - Backend validates super-admin role
   - Creates `impersonation_sessions` row
   - Generates `impersonationToken` (JWT or random secure string)
   - Sets short expiry (e.g., 4 hours) or tie to session cookie

2. **Impersonated Session Cookie:**
   - When impersonating, set a special cookie: `X-Impersonation-Session: impersonationToken`
   - This cookie is sent with every request (instead of the normal Clerk auth token)
   - Middleware recognizes this cookie and treats the request as if it's the tenant
   - All API calls see: `req.headers['x-impersonation-session']` → lookup session → get tenantId + original super-admin

3. **Tenant-Facing Routes (Impersonated):**
   - Middleware intercepts: if `x-impersonation-session` exists, set `userId` + `tenantId` from session table
   - User sees themselves as the tenant's super-admin
   - All `/tenant-admin/*` routes work as if they're logged in as that tenant
   - But every request is logged (see AC-5)

4. **End Impersonation:**
   - Click "Exit Impersonation" on banner
   - POST `/api/super-admin/impersonation/end`
   - Backend: sets `endedAt = now()`, `endedReason = 'manual'`
   - Clears session cookie
   - Redirects to super-admin dashboard
   - Show toast: "Impersonation ended. [View session log]"

5. **Auto-Expiry:**
   - If impersonation token expires (4 hours), auto-end session
   - Redirect super-admin to "Session Expired" page with option to start new one
   - Log reason: 'timeout'

### AC-5: Comprehensive Audit Logging (Traceability Required)

**✅ EVERY Action While Impersonating Must Be Logged**

Modify `audit_logs` to track impersonation:

```typescript
interface AuditLog {
  action: string // e.g., "update_product", "delete_customer"
  entityType: string
  entityId: string | null
  userId: string // Clerk ID of SUPER-ADMIN (who is actually performing the action)
  userEmail: string // Super-admin email (for compliance)
  impersonatedBySuperId?: string // CRITICAL: super-admin ID if impersonating
  impersonatedByEmail?: string // CRITICAL: super-admin email if impersonating
  impersonationSessionId?: string // link to impersonation_sessions table
  tenantId: string
  metadata: {
    details: object
  }
  ipAddress: string
  userAgent: string
  createdAt: timestamp
}
```

**CRITICAL: Every tenant-admin action must show WHO REALLY DID IT:**
- Product edit / delete / create → logs super-admin ID
- Customer edit / delete / export → logs super-admin ID
- Order status change → logs super-admin ID
- Email send → logs super-admin ID
- Template edit → logs super-admin ID
- Settings change → logs super-admin ID
- Branding change → logs super-admin ID
- Team member invite / remove → logs super-admin ID

**Special Impersonation Events (Metadata):**
- `super_admin_impersonation_start` (tenantId, superAdminId, notes)
- `super_admin_impersonation_end` (sessionId, reason: 'manual' | 'timeout', duration)

**View Audit Log (Super-Admin Only):**
- `/super-admin/impersonation/{sessionId}/audit-log`
- Shows **all actions taken during that session with super-admin clearly shown**
- Filterable by action type
- Exportable as CSV
- **Timestamp + action + what-changed + super-admin ID on every row**

**Compliance Note:**
- All impersonation is 100% auditable (perfect for GDPR / SOC 2 / compliance audits)
- Tenants CAN see they were impersonated (optional: email notification when support logs in)

### AC-6: API Endpoints

**POST `/api/super-admin/impersonation/start`**
```typescript
// Body
{
  tenantId: string,
  notes?: string // optional reason
}

// Response
{
  sessionId: string,
  impersonationUrl: string, // e.g., /tenant-admin (auto-redirect)
  expiresAt: timestamp,
  error?: string
}
```

**POST `/api/super-admin/impersonation/end`**
```typescript
// Response
{
  success: boolean,
  sessionId: string,
  error?: string
}
```

**GET `/api/super-admin/impersonation/sessions`**
```typescript
// Query: ?limit=50&offset=0&status=all|active|completed
// Response
{
  sessions: [{
    id: string,
    superAdminEmail: string,
    tenantName: string,
    tenantEmail: string,
    startedAt: timestamp,
    endedAt?: timestamp,
    duration: number (seconds),
    status: "active" | "completed",
    ipAddress: string
  }],
  total: number
}
```

**GET `/api/super-admin/impersonation/sessions/{sessionId}/audit-log`**
```typescript
// Response
{
  auditLogs: [{
    action: string,
    entityType: string,
    createdAt: timestamp,
    metadata: object
  }],
  total: number
}
```

**GET `/api/super-admin/tenants/search`**
```typescript
// Query: ?q=herb (search by business name, email)
// Response
{
  tenants: [{
    id: string,
    businessName: string,
    email: string,
    plan: string,
    createdAt: timestamp
  }]
}
```

### AC-7: Security & Constraints

**Constraints:**
- [ ] Only SUPER_ADMIN role can initiate impersonation
- [ ] Cannot impersonate another super-admin
- [ ] Session expires after 4 hours (configurable)
- [ ] Only one active impersonation per super-admin per tenant
- [ ] All requests include super-admin ID in audit log (for compliance)
- [ ] Impersonation IP address is logged
- [ ] Impersonation cannot be hidden (banner always visible)

**GDPR Compliance:**
- [ ] When super-admin is deleted from Clerk, all their impersonation sessions are ended
- [ ] Audit logs for impersonation are retained for 90 days (separate retention policy)
- [ ] Tenant sees they were impersonated IF they view audit logs (should we tell them? Yes, in UI: "Support team viewed this account on [date]")

### AC-8: Support Team UI / UX

**Dashboard `/super-admin`:**
- Add "Impersonation Sessions" card showing active sessions
- "Start Impersonation" quick-access button
- Widget: "Last 5 impersonation sessions" with tenant name + duration

**Notifications (Optional):**
- Webhook / notification when impersonation starts (log to support team Slack?)
- Notifications when impersonation ends

---

## Phase 1 Database Changes

1. **New Table:** `impersonation_sessions` (see AC-4)
2. **Alter `audit_logs`:** Add `impersonationSessionId` column (nullable, foreign key)
3. **Indexes:** 
   - `(superAdminClerkId, tenantId, endedAt)` for active sessions lookup
   - `(tenantId, startedAt)` for tenant-specific audit

---

## Success Metrics

- [ ] Support logs in as tenant in <30 seconds
- [ ] Impersonation banner is always visible (impossible to forget)
- [ ] All actions while impersonating are logged with super-admin ID
- [ ] Session expires after 4 hours
- [ ] Audit trail is downloadable for compliance

---

## Security Considerations

**Risks & Mitigations:**
- **Risk:** Super-admin deletes all customer data by accident
  - *Mitigation:* All actions logged; can be audited by compliance; consider "soft delete" for high-risk actions?
- **Risk:** Super-admin's account is compromised, impersonation is abused
  - *Mitigation:* All impersonation logged with IP; audit logs are immutable; support team can review sessions
- **Risk:** Tenant doesn't know they were impersonated
  - *Mitigation:* Audit logs are visible to tenant; should we send an email notification? (Future: add opt-in email)

---

## Out of Scope (Phase 2)

- Impersonation request approval workflow (manager approval before support can impersonate)
- Time-limited impersonation links (e.g., "customer can generate a one-time link for support")
- Two-factor impersonation (e.g., support requests impersonation, manager approves)
- Impersonation logs shown to tenants (audit log currently super-admin-only)
- Scheduled/recurring impersonation sessions
