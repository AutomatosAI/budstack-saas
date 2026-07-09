# PRD-301: Team Management & Role-Based Permissions (Phase 1)

**Status:** Spec Complete  
**Priority:** P0 (blocks subscription model)  
**Effort:** 5-6 sprint weeks  
**Owner:** Opus  

---

## Executive Summary

Enable tenant admins to invite team members with granular feature-based permissions. Integrate with Clerk's native organization + membership system for GDPR-compliant auth, while storing permission matrices in our DB.

**Why:** Customers want to delegate tasks (support can view customers, designers edit templates, etc.). Starter plan = 1 user; Pro plan = unlimited teams.

---

## Current State

- 1 Clerk Org = 1 Tenant (hardcoded)
- Roles: PATIENT, TENANT_ADMIN, SUPER_ADMIN
- No team/role management UX
- All admins have full access

---

## Phase 1: Team Invitations & Permissions Matrix

### AC-1: Clerk Integration (Membership + Roles)

**Acceptance Criteria:**
- [ ] Clerk `organizations.memberships` API is used for team member auth
- [ ] Each tenant's Clerk Org supports **5 preset roles**: `admin`, `editor`, `customer_support`, `web_designer`, `manager` (no custom role creation v1)
- [ ] Invite flow sends email from **our app** (not Clerk's native invitation email) with accept link + token (follow Automatos pattern)
- [ ] Accept invitation → user lands on `/accept-invite?token=xyz` → confirms → joins Clerk Org → linked to tenant via `clerkUserId`
- [ ] Removing a member from Clerk Org removes their app access immediately
- [ ] Clerk's GDPR deletion cascades to delete our audit logs for that user

**Technical Notes:**
- Preset roles (5 only) are defined in `role_permissions` table
- Admins can **customize permissions for each preset role** (e.g., "make Editor also able to delete products"), but cannot create new roles v1
- Clerk roles store the role name; our DB stores permission matrix (role → features)
- User's Clerk role + our matrix = build feature visibility at login

### AC-2: Permission Matrix (Roles → Features)

Create a new table `role_permissions` that maps **role → granular features**.

**Schema:**
```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  tenantId UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'admin', 'editor', 'customer_support', etc.
  -- Features (boolean flags for now; can extend to granular later)
  canViewCustomers BOOLEAN DEFAULT false,
  canEditCustomers BOOLEAN DEFAULT false,
  canExportCustomers BOOLEAN DEFAULT false,
  canDeleteCustomer BOOLEAN DEFAULT false,
  canViewOrders BOOLEAN DEFAULT false,
  canEditOrders BOOLEAN DEFAULT false,
  canViewProducts BOOLEAN DEFAULT false,
  canEditProducts BOOLEAN DEFAULT false,
  canDeleteProducts BOOLEAN DEFAULT false,
  canViewAnalytics BOOLEAN DEFAULT false,
  canEditSettings BOOLEAN DEFAULT false,
  canManageBranding BOOLEAN DEFAULT false,
  canInviteTeamMembers BOOLEAN DEFAULT false,
  canDeleteTeamMembers BOOLEAN DEFAULT false,
  canViewAuditLogs BOOLEAN DEFAULT false,
  canViewCRM BOOLEAN DEFAULT false,
  canEditEmails BOOLEAN DEFAULT false,
  canViewTemplates BOOLEAN DEFAULT false,
  canEditTemplates BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenantId, role)
);
```

**Default Permission Sets** (seeded at tenant creation):
- **Admin**: All permissions = true
- **Editor**: Can view/edit products & templates, view orders, edit CRM
- **Customer Support**: Can view/export customers, view orders, delete customers (GDPR), edit CRM
- **Web Designer**: Can edit templates, branding, view products (read-only)
- **Manager**: Can view analytics, orders, customers (read-only), manage emails

### AC-3: Invite Team Members (Admin-Only)

**UI: `/tenant-admin/team` (new page) — Invite Modal**

**Pattern:** Reuse/adapt Automatos `invite-modal` component (same UX as automatos-ai/frontend/components/team/invite-modal.tsx).

**Flow:**
1. Admin clicks "Invite Team Member" → opens modal
2. Modal collects: Email + Role dropdown (reads **5 preset roles only**: Admin, Editor, Customer Support, Web Designer, Manager)
3. Submit → call POST `/api/tenant-admin/team/invite`
4. API:
   - Validate email not already a member/invited
   - Create invitation in DB with unique token (`team_invitations` table, see AC-3b)
   - **Send email from our app** (via Mailgun/SendGrid) with accept link + token (NOT Clerk's native email)
   - Log to `audit_logs` (action: "invite_team_member", email, role)
   - Return invite status
5. UI confirms: "Invitation sent to jane@example.com" + shows pending invite with resend/revoke buttons
6. Invitee receives email with invite link → clicks → lands on `/accept-invite?token=xyz`
7. `/accept-invite` page: "Accept invitation to [TenantName]?" → clicks Accept → Clerk signup/login → joins Clerk Org → redirected to dashboard

**Error Cases:**
- Email already invited → show "Already invited, resend?" 
- Email already a member → show "Already a team member"
- Quota exceeded (Starter plan) → "Your plan allows 1 user. Upgrade to add teammates."

### AC-3b: Team Invitations Table & Accept Flow

**New Table:**
```sql
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL, -- one of: admin, editor, customer_support, web_designer, manager
  invitationToken TEXT UNIQUE NOT NULL, -- secure random, used in accept link
  invitedBy TEXT NOT NULL, -- Clerk user ID who sent it
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'revoked'
  acceptedAt TIMESTAMP,
  expiresAt TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'),
  sentAt TIMESTAMP DEFAULT NOW(),
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenantId, email) -- only one pending invite per email per tenant
);
```

**Invite Email Template:**
```
Subject: [TenantName] invited you to join their BudStacks team

Hi [FirstName],

[TenantName] invited you to join their BudStacks team as a [Role].

You'll be able to [describe role permissions].

[Accept Invitation →] https://budstacks.io/accept-invite?token=abc123xyz&email=jane@example.com

This link expires in 7 days.

Questions? Reply to this email.
```

**Accept Invite Flow (GET `/accept-invite?token=xyz&email=...`):**
1. Validate token exists + not expired + status='pending' + matches email
2. If user not logged in → redirect to `/auth/login?redirectAfter=/accept-invite?token=...`
3. If logged in → show confirmation page: "Accept invitation to [TenantName] as [Role]?" → click Accept
4. POST `/api/tenant-admin/team/accept-invite`:
   - Mark invitation as `accepted`, set `acceptedAt = now()`
   - Create Clerk org membership (if not already exists)
   - Update Clerk user's publicMetadata.tenantId + role
   - Log to `audit_logs` (action: "accept_team_invitation", email)
   - Redirect to `/tenant-admin/dashboard`

### AC-4: Manage Roles & Permissions (Admin-Only)

**UI: `/tenant-admin/team/roles` (new page)**

**Flow:**
1. Show table of **5 preset roles** + their permissions:
   | Role | View Customers | Edit Customers | View Orders | Edit Products | ... |
   |------|---|---|---|---|---|
   | Admin | ✅ | ✅ | ✅ | ✅ | ... |
   | Editor | ✅ | ✅ | ✅ | ✅ | ... |
   | Customer Support | ✅ | ✅ | ✅ | ❌ | ... |
   | Web Designer | ❌ | ❌ | ❌ | ✅ | ... |
   | Manager | ✅ | ❌ | ✅ | ❌ | ... |

2. For each preset role:
   - **Toggle each permission** (customize what this role can do)
   - "Save" → PUT `/api/tenant-admin/team/roles/{role}`
   - Log to `audit_logs` (action: "update_role_permissions", role, changes)

**Constraints (v1):**
- **No custom role creation** (only 5 preset roles available)
- Admin role **cannot be edited** (always all permissions)
- Cannot delete any preset role
- Cannot rename preset roles

**Future (v2):** Custom role creation, role templates, role inheritance

### AC-5: View Team Members (Admin-Only)

**UI: `/tenant-admin/team/members` (new page)**

**Table:**
| Name | Email | Role | Status | Invited | Actions |
|------|-------|------|--------|---------|---------|
| Jane | jane@... | Editor | Active | 2 days ago | Remove |
| Bob | bob@... | Customer Support | Pending | 5 mins ago | Resend / Cancel |

**Columns:**
- Name: from Clerk user
- Email: from Clerk user
- Role: from Clerk membership
- Status: "Active" (accepted) / "Pending" (invite sent, not accepted)
- Invited: when invite was sent
- Actions: Remove (revoke from Clerk Org) / Resend (send invite again)

**Remove Flow:**
1. Click "Remove" → confirm modal
2. API: DELETE `/api/tenant-admin/team/members/{clerkUserId}`
3. Call `clerk.organizations.updateOrganizationMembership(orgId, userId, { role: null })`  (removes from org)
4. Log to `audit_logs` (action: "remove_team_member")

### AC-6: Route Protection (New Middleware)

Add middleware to all `/tenant-admin/*` routes:

**Logic:**
```
1. Get Clerk user
2. Find their Clerk Org role
3. Look up role_permissions for that role + tenant
4. Check if route requires permission (e.g., /products needs canViewProducts)
5. If denied → redirect to 403 or hide the page
```

**Routes → Required Permissions:**
```
/tenant-admin/customers                → canViewCustomers
/tenant-admin/customers/[id]           → canViewCustomers
/tenant-admin/orders                   → canViewOrders
/tenant-admin/products                 → canViewProducts
/tenant-admin/templates                → canViewTemplates
/tenant-admin/settings                 → canEditSettings
/tenant-admin/branding                 → canManageBranding
/tenant-admin/team                     → canInviteTeamMembers (admin only)
/tenant-admin/analytics                → canViewAnalytics
/tenant-admin/emails                   → canViewEmails
/tenant-admin/audit-logs               → canViewAuditLogs
```

### AC-7: Audit Logging (All Team Actions)

Log to existing `audit_logs` table:

**Events to Log:**
- `invite_team_member` (email, role)
- `remove_team_member` (email, role)
- `update_role_permissions` (role, changed permissions)
- `create_custom_role` (role name, permissions)
- `delete_custom_role` (role name)

**Structure:**
```typescript
interface AuditEvent {
  action: string
  entityType: "TeamMember" | "Role"
  entityId: string | null
  userId: string (Clerk user ID of who did it)
  tenantId: string
  metadata: {
    email?: string
    role?: string
    permissions?: object
  }
  createdAt: timestamp
}
```

---

## Phase 1 API Endpoints

### POST `/api/tenant-admin/team/invite`
**Body:** `{ email: string, role: string }`  
**Returns:** `{ success: boolean, invitationId?: string, error?: string }`  
**Auth:** Requires `canInviteTeamMembers` permission

### GET `/api/tenant-admin/team/members`
**Returns:** `{ members: [{ email, name, role, status, invitedAt }] }`  
**Auth:** Requires `canInviteTeamMembers` permission

### DELETE `/api/tenant-admin/team/members/{clerkUserId}`
**Returns:** `{ success: boolean, error?: string }`  
**Auth:** Requires `canDeleteTeamMembers` permission

### GET `/api/tenant-admin/team/roles`
**Returns:** `{ roles: [{ name: string, permissions: object }] }`  
**Auth:** Requires `canEditSettings` permission

### POST `/api/tenant-admin/team/roles`
**Body:** `{ name: string, permissions: object }`  
**Returns:** `{ id: string, error?: string }`  
**Auth:** Requires `canEditSettings` permission (admin only for defaults)

### PUT `/api/tenant-admin/team/roles/{role}`
**Body:** `{ permissions: object }`  
**Returns:** `{ success: boolean, error?: string }`  
**Auth:** Requires `canEditSettings` permission

---

## Phase 1 Database Changes

1. **New Table:** `role_permissions` (see AC-2)
2. **New Table:** `team_invitations` (see AC-3b)
3. **Alter `audit_logs`:** Add `impersonationSessionId` column (nullable)
4. **Migration:** Seed default permission sets for all existing tenants
5. **No changes to `users` table** (Clerk handles team membership)

---

## Audit Log Retention Policy

**Why:** Compliance requirements (GDPR, SOC 2, PCI DSS, HIPAA) mandate audit log retention. Standard practice: 90 days–1 year.

### AC-8: Default Retention & Configuration

**Default Retention Period:** 90 days (configurable per plan/customer)

| Plan | Audit Retention | Justification |
|------|-----------------|---------------|
| Starter | 90 days | SOC 2 minimum recommendation |
| Pro | 180 days | Standard SaaS practice |
| Enterprise | 1 year (365 days) | Higher compliance bar + potential HIPAA overlap |

**Configurable Setting (Admin Dashboard):**
- Path: `/tenant-admin/settings/audit-retention`
- Dropdown: "90 days", "180 days", "1 year", "Indefinite" (Enterprise only)
- Default: Plan-based (see table above)
- Changes logged to `audit_logs` (action: "update_audit_retention_policy")

**Automatic Cleanup:**
- Nightly job (11 PM UTC): `DELETE FROM audit_logs WHERE createdAt < NOW() - INTERVAL '{retentionDays} days' AND tenantId = ...`
- Non-reversible (audit logs deleted are gone; record in system log before deletion)
- Exception: Impersonation logs are kept separately (longer retention = 1 year minimum for compliance)

**Impersonation Session Logs (Longer Retention):**
- Impersonation-specific logs: **minimum 1 year** (never auto-delete, even on Starter)
- Reason: High-risk operations require longer audit trail for compliance + support escalations
- Can be manually deleted by super-admin if tenant requests (logged)

---

## Success Metrics

- [ ] Team admins can invite teammates in <30 seconds
- [ ] Permissions take effect immediately (no page reload)
- [ ] All audit logs captured
- [ ] Clerk Org removal immediately revokes app access

---

## Out of Scope (Phase 2)

- Custom role templates marketplace
- Permission inheritance / hierarchies
- Time-limited invitations
- Bulk member uploads
- SAML/SSO provisioning
- Per-tenant RBAC audit reports
