# PRD: Tenant Template Upload & Community Marketplace

## 1. Introduction

Enable tenants to upload their own templates (via GitHub repo URL) to their private tenant S3 space, and optionally share them to the public marketplace pending super admin approval. This extends the existing template system — which currently only allows super admins to upload marketplace templates and tenants to clone them — into a two-way ecosystem where tenants are both consumers and contributors.

**Current State:**
- Super admins upload templates from GitHub → stored in platform S3 (`templates/{slug}/`)
- Tenants browse the marketplace → clone templates to their tenant S3 (`tenants/{id}/templates/{ts}/`)
- Tenants cannot create or upload their own templates
- No community contribution pipeline exists

**Target State:**
- Tenants upload templates from GitHub → stored in tenant S3 (`tenants/{id}/custom-templates/{slug}/`)
- Tenant-uploaded templates are private to that tenant (no other tenants can see them)
- Tenants can edit, delete, activate, and manage their custom templates identically to cloned marketplace templates
- Tenants can submit a template to the community marketplace → super admin review → approve/reject/edit
- Approved community templates appear in the marketplace with author attribution
- Marketplace copies are independent — tenant can delete their original without affecting the marketplace version

## 2. Goals

- **Tenant Empowerment:** Let tenants bring their own designs without depending on platform templates
- **Community Marketplace:** Enable a template ecosystem where tenants contribute and benefit
- **Tenant Isolation:** Custom templates live exclusively in tenant S3 space — invisible to others
- **Quality Control:** All marketplace submissions go through super admin review before going live
- **Consistency:** Upload flow mirrors the existing super admin GitHub upload — same validation, same 4-file format
- **Zero Breaking Changes:** Existing template clone/activate/customize flows remain unchanged

## 3. User Stories

### 3.1. HIGH PRIORITY — Tenant Template Upload

#### US-001: Upload Template from GitHub
**Description:** As a tenant admin, I want to upload a template from a GitHub repo URL so I can use my own custom design on my store.

**Acceptance Criteria:**
- [ ] New "Upload Template" button on the tenant admin Templates → My Templates tab
- [ ] Upload dialog accepts: Template name, GitHub repo URL
- [ ] System downloads repo, validates the 4 required files (`layout.json`, `defaults.json`, `template.config.json`, `styles.css`)
- [ ] Validates all section types in `layout.json` exist in the section registry
- [ ] Files uploaded to tenant S3: `tenants/{tenantId}/custom-templates/{slug}/`
- [ ] Creates a `TenantTemplate` record with `source: 'custom'` (new field)
- [ ] Populates `designSystem`, `pageContent`, `navigation`, `footer` from `defaults.json`
- [ ] Template appears in "My Templates" tab with a "Custom" badge
- [ ] Error states: Invalid repo URL, missing files, invalid section types, S3 upload failure
- [ ] Audit log entry created
- [ ] Typecheck/lint passes

#### US-002: Manage Custom Templates
**Description:** As a tenant admin, I want to manage my uploaded templates the same way I manage cloned templates — activate, customize, delete.

**Acceptance Criteria:**
- [ ] Custom templates appear alongside cloned templates in My Templates tab
- [ ] "Custom" badge distinguishes them from cloned marketplace templates
- [ ] Activate button works — sets as active template, deactivates others
- [ ] Customize → Branding page works (change colors, fonts, logo, hero)
- [ ] Delete button works — removes S3 files from tenant space + deletes `TenantTemplate` record
- [ ] Delete confirmation dialog warns if template is currently active
- [ ] Cannot delete if template has a pending marketplace submission (must withdraw first)
- [ ] Audit log entries for all actions

#### US-003: Re-upload / Update Custom Template
**Description:** As a tenant admin, I want to update my custom template by re-uploading from GitHub so I can iterate on my design.

**Acceptance Criteria:**
- [ ] "Update from GitHub" action on custom template card
- [ ] Re-downloads repo and re-validates files
- [ ] Overwrites existing files in tenant S3 (`tenants/{tenantId}/custom-templates/{slug}/`)
- [ ] Updates `TenantTemplate` record with new `designSystem`/`pageContent` from `defaults.json`
- [ ] Preserves tenant's branding overrides in DB (colors, logo, etc.) — only updates the base template files
- [ ] If template is active, changes reflect immediately (hot-deploy)
- [ ] Shows diff summary: "Updated 3 of 4 files" or similar
- [ ] Audit log entry created

#### US-004: Template Validation & Preview
**Description:** As a tenant admin, I want to preview my uploaded template before activating it so I can verify it looks correct.

**Acceptance Criteria:**
- [ ] After upload, template shows "Draft" status
- [ ] "Preview" button opens the template in a new tab using the tenant's storefront URL with `?preview=templateId` param
- [ ] Preview renders the template with tenant branding overrides applied
- [ ] Preview banner at top: "Template Preview — Not yet active"
- [ ] Preview does not affect the live storefront

### 3.2. HIGH PRIORITY — Community Marketplace Submission

#### US-005: Submit Template to Marketplace
**Description:** As a tenant admin, I want to share my custom template with the marketplace so other tenants can use it.

**Acceptance Criteria:**
- [ ] "Share to Marketplace" button on custom template cards (not available on cloned marketplace templates)
- [ ] Submission dialog collects: description (pre-filled from `template.config.json`), category, tags
- [ ] Creates a `marketplace_submissions` record with status `pending`
- [ ] Copies template files to a staging S3 path: `marketplace-submissions/{submissionId}/`
- [ ] Files are copied (not moved) — tenant's original remains in their tenant space
- [ ] Tenant cannot submit the same template twice while a submission is pending
- [ ] Confirmation: "Your template has been submitted for review. You'll be notified when it's approved."
- [ ] Audit log entry created

#### US-006: Track Submission Status
**Description:** As a tenant admin, I want to see the status of my marketplace submissions so I know if they've been approved or need changes.

**Acceptance Criteria:**
- [ ] Submission status badge on template card: "Pending Review", "Approved", "Rejected", "Changes Requested"
- [ ] If rejected: show reviewer feedback message
- [ ] If changes requested: tenant can update template and re-submit
- [ ] Link to view the submitted version (read-only)
- [ ] Notification (in-app or email) when status changes

#### US-007: Withdraw Marketplace Submission
**Description:** As a tenant admin, I want to withdraw my pending submission if I change my mind.

**Acceptance Criteria:**
- [ ] "Withdraw Submission" action available when status is `pending` or `changes_requested`
- [ ] Deletes staging S3 files at `marketplace-submissions/{submissionId}/`
- [ ] Updates `marketplace_submissions` status to `withdrawn`
- [ ] Template card returns to normal (no submission badge)
- [ ] Cannot withdraw after approval (marketplace copy is independent)
- [ ] Confirmation dialog before withdrawal

### 3.3. HIGH PRIORITY — Super Admin Review

#### US-008: Review Submitted Templates
**Description:** As a super admin, I want to review community-submitted templates so I can approve quality content for the marketplace.

**Acceptance Criteria:**
- [ ] New "Community Submissions" tab/section on super admin Templates page
- [ ] Shows all pending submissions with: template name, submitter tenant name, submission date, category, tags
- [ ] Sortable by date submitted
- [ ] Count badge on tab: "Community Submissions (3)"
- [ ] Click to open review detail view

#### US-009: Review Detail View
**Description:** As a super admin, I want to preview and inspect a submitted template in detail before making a decision.

**Acceptance Criteria:**
- [ ] Shows template metadata: name, description, category, tags, submitter
- [ ] Preview button: renders the template in an iframe or new tab using staging S3 files
- [ ] Shows the 4 template files with syntax-highlighted JSON/CSS
- [ ] Validation report: section types valid? Required files present? CSS safe?
- [ ] Action buttons: Approve, Reject, Request Changes, Edit & Approve

#### US-010: Approve Submission
**Description:** As a super admin, I want to approve a submission to publish it to the marketplace.

**Acceptance Criteria:**
- [ ] "Approve" action on review detail view
- [ ] Copies files from `marketplace-submissions/{submissionId}/` to `templates/{slug}/`
- [ ] Creates a new `templates` record with: `source: 'community'`, `authorTenantId`, `authorName`
- [ ] Sets `isActive: true`, `isPublic: true` on the template record
- [ ] Template appears in the marketplace for all tenants
- [ ] Updates `marketplace_submissions` status to `approved`
- [ ] Notifies the submitter tenant (in-app notification)
- [ ] Audit log entry created
- [ ] Marketplace copy is fully independent of tenant's original

#### US-011: Reject Submission
**Description:** As a super admin, I want to reject a submission with feedback so the tenant knows why and can improve.

**Acceptance Criteria:**
- [ ] "Reject" action with required feedback text field
- [ ] Updates `marketplace_submissions` status to `rejected`
- [ ] Stores feedback in `marketplace_submissions.reviewerFeedback`
- [ ] Notifies the submitter tenant with the feedback message
- [ ] Staging S3 files retained for 30 days then auto-cleaned
- [ ] Audit log entry created

#### US-012: Request Changes
**Description:** As a super admin, I want to request specific changes before approving so I can guide the tenant toward a publishable template.

**Acceptance Criteria:**
- [ ] "Request Changes" action with required feedback text field
- [ ] Updates `marketplace_submissions` status to `changes_requested`
- [ ] Notifies the submitter tenant with the feedback
- [ ] Tenant can update their template and re-submit (see US-003 + US-005)
- [ ] Re-submission resets status to `pending` and updates staging files
- [ ] Previous feedback preserved in a history log

#### US-013: Edit & Approve
**Description:** As a super admin, I want to make minor edits to a submitted template before publishing so I can fix small issues without back-and-forth.

**Acceptance Criteria:**
- [ ] "Edit & Approve" opens an inline editor for the 4 template files
- [ ] Editor shows JSON/CSS with syntax highlighting
- [ ] Changes saved to the staging S3 path first
- [ ] Preview updates to reflect edits
- [ ] On confirm: same approval flow as US-010 but with the edited files
- [ ] Audit log records both the edit and approval actions
- [ ] Notifies tenant: "Your template was approved with minor edits"

### 3.4. MEDIUM PRIORITY — Marketplace Attribution & Display

#### US-014: Community Template Attribution
**Description:** As a marketplace browser, I want to see who created community templates so I can recognize contributors.

**Acceptance Criteria:**
- [ ] Community templates in the marketplace show "By {businessName}" under the template name
- [ ] "Community" badge distinguishes from platform-created templates
- [ ] Platform templates show "By BudStacks Platform" (or no attribution)
- [ ] Clicking the author name does NOT navigate anywhere (no tenant profile page in v1)

#### US-015: Filter Marketplace by Source
**Description:** As a tenant admin, I want to filter the marketplace by platform vs community templates.

**Acceptance Criteria:**
- [ ] Filter dropdown or tabs: "All Templates", "Platform", "Community"
- [ ] Default: "All Templates"
- [ ] Count shown: "Community (7)"
- [ ] Filter persists during the session

### 3.5. MEDIUM PRIORITY — Notifications

#### US-016: Submission Lifecycle Notifications
**Description:** As a tenant admin, I want to receive notifications about my submission status changes.

**Acceptance Criteria:**
- [ ] Notification sent when: Approved, Rejected, Changes Requested
- [ ] In-app notification (header bell icon if exists, or toast on next login)
- [ ] Email notification (if email system is configured — see `prd-email-system.md`)
- [ ] Notification includes: template name, new status, reviewer feedback (if any)

#### US-017: Super Admin Submission Alert
**Description:** As a super admin, I want to know when new submissions arrive so I can review them promptly.

**Acceptance Criteria:**
- [ ] Dashboard widget or notification badge shows pending submission count
- [ ] "New submission: {templateName} from {tenantName}" alert
- [ ] Quick link to the review queue

## 4. Data Model Changes

### 4.1. New Table: `marketplace_submissions`

```sql
CREATE TABLE marketplace_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  tenant_template_id UUID NOT NULL REFERENCES tenant_templates(id),

  -- Submission metadata
  template_name   TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  tags            TEXT[],

  -- S3 location of the submitted copy
  staging_s3_path TEXT NOT NULL,

  -- Review workflow
  status          TEXT NOT NULL DEFAULT 'pending',
    -- pending, approved, rejected, changes_requested, withdrawn
  reviewer_id     UUID REFERENCES users(id),
  reviewer_feedback TEXT,
  review_history  JSONB DEFAULT '[]',
    -- Array of { status, feedback, reviewerId, timestamp }

  -- If approved, link to the created marketplace template
  approved_template_id UUID REFERENCES templates(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX idx_submissions_tenant ON marketplace_submissions(tenant_id);
CREATE INDEX idx_submissions_status ON marketplace_submissions(status);
```

### 4.2. Modified Table: `tenant_templates`

```sql
-- Add source field to distinguish cloned vs custom-uploaded templates
ALTER TABLE tenant_templates ADD COLUMN source TEXT NOT NULL DEFAULT 'cloned';
  -- 'cloned' = cloned from marketplace
  -- 'custom' = uploaded by tenant from GitHub

-- Add github_url for re-upload capability
ALTER TABLE tenant_templates ADD COLUMN github_url TEXT;
```

### 4.3. Modified Table: `templates`

```sql
-- Add community attribution fields
ALTER TABLE templates ADD COLUMN source TEXT NOT NULL DEFAULT 'platform';
  -- 'platform' = uploaded by super admin
  -- 'community' = submitted by tenant, approved by super admin

ALTER TABLE templates ADD COLUMN author_tenant_id UUID REFERENCES tenants(id);
ALTER TABLE templates ADD COLUMN author_name TEXT;
  -- Snapshot of tenant businessName at time of approval (survives tenant rename)
```

## 5. S3 Path Structure

```
s3://{bucket}/{prefix}/
├── templates/                              # Marketplace templates (unchanged)
│   ├── healingbuds/
│   ├── cannabizz/
│   └── tenant-submitted-slug/              # NEW: approved community templates
│
├── marketplace-submissions/                # NEW: pending review staging area
│   ├── {submissionId}/
│   │   ├── layout.json
│   │   ├── defaults.json
│   │   ├── template.config.json
│   │   └── styles.css
│   └── {submissionId2}/
│
├── tenants/
│   ├── {tenantId}/
│   │   ├── templates/                      # Cloned templates (unchanged)
│   │   │   └── {timestamp}/
│   │   ├── custom-templates/               # NEW: tenant-uploaded templates
│   │   │   ├── {slug}/
│   │   │   │   ├── layout.json
│   │   │   │   ├── defaults.json
│   │   │   │   ├── template.config.json
│   │   │   │   └── styles.css
│   │   │   └── {slug2}/
│   │   └── uploads/
│   └── {tenantId2}/
```

**Isolation guarantee:** A tenant's custom templates at `tenants/{tenantId}/custom-templates/` are only accessible via signed URLs generated for that tenant. No other tenant's API routes generate URLs pointing to another tenant's S3 prefix.

## 6. API Routes

### 6.1. Tenant Admin Routes (New)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/tenant-admin/templates/upload` | POST | Upload template from GitHub to tenant S3 |
| `/api/tenant-admin/templates/[id]/update-from-github` | POST | Re-upload/update custom template from GitHub |
| `/api/tenant-admin/templates/[id]/submit-to-marketplace` | POST | Submit template for marketplace review |
| `/api/tenant-admin/templates/[id]/withdraw-submission` | POST | Withdraw pending marketplace submission |
| `/api/tenant-admin/submissions` | GET | List tenant's marketplace submissions |

### 6.2. Super Admin Routes (New)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/super-admin/submissions` | GET | List all marketplace submissions (filterable by status) |
| `/api/super-admin/submissions/[id]` | GET | Get submission detail with template files |
| `/api/super-admin/submissions/[id]/approve` | POST | Approve submission → publish to marketplace |
| `/api/super-admin/submissions/[id]/reject` | POST | Reject submission with feedback |
| `/api/super-admin/submissions/[id]/request-changes` | POST | Request changes with feedback |
| `/api/super-admin/submissions/[id]/edit` | PUT | Edit submission files before approving |

### 6.3. Existing Routes (No Changes)

All existing template clone, activate, delete, and customize routes remain unchanged. Custom templates use the same `TenantTemplate` model so existing activate/customize flows work automatically.

## 7. Functional Requirements

### 7.1. Upload & Validation
- **FR-1:** Tenant upload uses the same GitHub download + validation pipeline as super admin upload
- **FR-2:** Validation checks: `template.config.json` exists, `layout.json` section types are registered, no forbidden CSS patterns
- **FR-3:** Template slug must be unique within the tenant's custom templates (not globally unique)
- **FR-4:** Maximum template file size: 10MB total (excluding assets in `assets/` subfolder)
- **FR-5:** Assets folder (`assets/`) is optional and copied if present

### 7.2. Tenant Isolation
- **FR-6:** Custom template S3 paths MUST include `tenantId`: `tenants/{tenantId}/custom-templates/{slug}/`
- **FR-7:** API routes MUST verify `tenantTemplate.tenantId === authenticatedUser.tenantId`
- **FR-8:** No API endpoint exposes tenant-uploaded templates to other tenants
- **FR-9:** Signed URLs for custom template assets are scoped to the owning tenant only

### 7.3. Marketplace Submission
- **FR-10:** Submission creates an independent copy in `marketplace-submissions/` — not a reference
- **FR-11:** Tenant can continue editing their local template after submission without affecting the staged version
- **FR-12:** Only custom templates (`source: 'custom'`) can be submitted — cloned marketplace templates cannot
- **FR-13:** One active submission per template (must withdraw or wait for review before re-submitting)
- **FR-14:** Re-submission after "changes requested" updates the staging files and resets status to `pending`

### 7.4. Review Workflow
- **FR-15:** Super admin review queue shows submissions in chronological order (oldest first)
- **FR-16:** Approval copies files to platform `templates/{slug}/` and creates a `templates` record
- **FR-17:** Approved template slug must be globally unique — if conflict, super admin can rename during edit
- **FR-18:** Rejection feedback is required (cannot reject without a reason)
- **FR-19:** Edit & Approve modifies the staging copy, then follows the normal approval flow
- **FR-20:** All review actions are logged with reviewer ID and timestamp

### 7.5. Attribution
- **FR-21:** Community templates display author tenant name in the marketplace
- **FR-22:** Author name is snapshot at approval time (stored in `templates.author_name`)
- **FR-23:** If the author tenant is later deleted, the marketplace template and attribution remain

### 7.6. Lifecycle Independence
- **FR-24:** Approved marketplace templates are fully independent of the tenant's original
- **FR-25:** Tenant deleting their custom template does NOT remove the marketplace version
- **FR-26:** Tenant deleting their account does NOT remove approved marketplace templates
- **FR-27:** Super admin can delete community marketplace templates the same as platform templates

## 8. Non-Goals (Out of Scope)

- **Paid Templates / Revenue Sharing:** Community templates are free in v1. Pricing hooks may be added later.
- **Template Versioning:** No version history or rollback for custom templates. Re-upload overwrites.
- **Direct File Upload:** v1 uses GitHub repo URL only. Drag-and-drop file upload can be a future enhancement.
- **Template Forking:** Tenants cannot fork another tenant's community template into an editable version (they clone it like any marketplace template).
- **Community Profiles:** No public profile pages for template authors. Attribution is name-only.
- **Automated Quality Checks:** No AI-based design review or automated scoring. Manual super admin review only.
- **Comments / Discussion:** No comment thread between reviewer and submitter. Feedback is one-way per review cycle.
- **Asset Marketplace:** Template assets (images, videos) are not shared. Only the 4 config/style files are submitted.

## 9. Design Considerations

### 9.1. Tenant Admin Templates Page

**Tab: My Templates (updated)**
```
┌─────────────────────────────────────────────────────────────────┐
│  My Templates                          [+ Upload Template]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  CannaBizz   │  │  My Design   │  │  Custom V2   │          │
│  │  ─────────── │  │  ─────────── │  │  ─────────── │          │
│  │  [Cloned]    │  │  [Custom]    │  │  [Custom]    │          │
│  │  ✅ Active   │  │  Draft       │  │  ⏳ Pending  │          │
│  │              │  │              │  │  Review      │          │
│  │  Customize   │  │  Activate    │  │  Withdraw    │          │
│  │              │  │  Share ↗     │  │              │          │
│  │              │  │  Update ↻    │  │              │          │
│  │              │  │  Delete ✕    │  │  Delete ✕    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Badge states:**
- `Cloned` — light blue badge (cloned from marketplace)
- `Custom` — purple badge (uploaded by tenant)
- `Pending Review` — yellow badge (submitted to marketplace, awaiting review)
- `Approved` — green badge (published to marketplace)
- `Rejected` — red badge (submission rejected — show feedback on hover)
- `Changes Requested` — orange badge (reviewer wants changes)

**Actions per state:**

| Template State | Available Actions |
|---|---|
| Custom (not submitted) | Activate, Customize, Preview, Share to Marketplace, Update from GitHub, Delete |
| Custom (pending review) | Activate, Customize, Preview, Withdraw Submission |
| Custom (approved) | Activate, Customize, Preview, Update from GitHub, Delete |
| Custom (rejected) | Activate, Customize, Preview, Share to Marketplace (re-submit), Update from GitHub, Delete |
| Custom (changes requested) | Activate, Customize, Preview, Update & Re-submit, Withdraw, Delete |
| Cloned | Activate, Customize, Delete (unchanged) |

### 9.2. Upload Dialog

```
┌───────────────────────────────────────────────────────┐
│  Upload Template from GitHub                     [X]  │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Template Name                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ My Custom Design                                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  GitHub Repository URL                                │
│  ┌─────────────────────────────────────────────────┐  │
│  │ https://github.com/user/my-template             │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ℹ️  Repository must contain:                         │
│     layout.json, defaults.json,                       │
│     template.config.json, styles.css                  │
│                                                       │
│  [Cancel]                    [Upload & Validate]      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 9.3. Share to Marketplace Dialog

```
┌───────────────────────────────────────────────────────┐
│  Share to Marketplace                            [X]  │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Your template will be submitted for review by the    │
│  BudStacks team. Once approved, it will appear in the  │
│  marketplace for all tenants to use.                  │
│                                                       │
│  Template: My Custom Design                           │
│  Author: Healing Buds Store (your business name)      │
│                                                       │
│  Description                                          │
│  ┌─────────────────────────────────────────────────┐  │
│  │ A vibrant dark-themed dispensary template...     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  Category: [modern ▾]                                 │
│  Tags:     [dark] [premium] [+ add]                   │
│                                                       │
│  ⚠️  A copy of your template files will be submitted. │
│  Your local template is not affected.                 │
│                                                       │
│  [Cancel]                         [Submit for Review] │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 9.4. Super Admin Review Queue

```
┌─────────────────────────────────────────────────────────────────┐
│  Store Templates                                                 │
│  [All Templates]  [Community Submissions (3)]                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🟡 My Custom Design        by Healing Buds Store        │    │
│  │    Category: modern  |  Tags: dark, premium             │    │
│  │    Submitted: Feb 10, 2026                              │    │
│  │    [Preview]  [Review →]                                │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ 🟡 Green Dream Template    by GTA Cannabis Co           │    │
│  │    Category: medical  |  Tags: clean, green             │    │
│  │    Submitted: Feb 12, 2026                              │    │
│  │    [Preview]  [Review →]                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.5. Review Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Submissions                                          │
│                                                                  │
│  My Custom Design                    Status: 🟡 Pending Review  │
│  by Healing Buds Store                                          │
│  Submitted: Feb 10, 2026                                        │
│                                                                  │
│  Description: A vibrant dark-themed dispensary template with...  │
│  Category: modern  |  Tags: dark, premium                       │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │  [Preview]               │  │  Validation                  │ │
│  │  Opens in new tab        │  │  ✅ layout.json valid         │ │
│  │                          │  │  ✅ defaults.json valid       │ │
│  │                          │  │  ✅ template.config.json valid│ │
│  │                          │  │  ✅ styles.css safe           │ │
│  │                          │  │  ✅ All sections registered   │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Files                                                    │   │
│  │  [layout.json] [defaults.json] [config.json] [styles.css]│   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │ {                                                  │   │   │
│  │  │   "version": "1.0.0",                              │   │   │
│  │  │   "navigation": "NavFull",                         │   │   │
│  │  │   "sections": [                                    │   │   │
│  │  │     ...                                            │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Feedback (required for Reject / Request Changes)         │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │                                                    │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Reject]  [Request Changes]  [Edit & Approve]  [✅ Approve]    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 10. Technical Considerations

### 10.1. Reuse Existing Infrastructure
- **GitHub download pipeline:** Reuse the super admin `downloadAndExtractRepo()` function from the upload route
- **S3 operations:** Reuse existing `uploadDirectoryToS3()`, `copyS3Directory()`, `getJsonFromS3()` from `lib/s3.ts`
- **Template validation:** Extract validation logic from super admin upload into a shared `validateTemplate()` function
- **CSS sanitization:** Same sanitization pipeline applies to tenant-uploaded CSS
- **Rendering pipeline:** Custom templates use the exact same `TemplateRenderer` → `section-registry` pipeline — no rendering changes needed

### 10.2. Service Layer

Create a new service: `lib/tenant-template-upload-service.ts`
- `uploadFromGitHub(tenantId, name, githubUrl)` — download, validate, upload to tenant S3, create TenantTemplate
- `updateFromGitHub(tenantTemplateId)` — re-download and overwrite
- `submitToMarketplace(tenantTemplateId, metadata)` — copy to staging, create submission
- `withdrawSubmission(submissionId)` — clean up staging, update status

Create a new service: `lib/marketplace-submission-service.ts`
- `listSubmissions(filters)` — query submissions with status filter
- `getSubmissionDetail(submissionId)` — submission + file contents from staging S3
- `approveSubmission(submissionId, reviewerId)` — copy to marketplace, create template record
- `rejectSubmission(submissionId, reviewerId, feedback)` — update status, store feedback
- `requestChanges(submissionId, reviewerId, feedback)` — update status, store feedback
- `editSubmission(submissionId, files)` — update staging files

### 10.3. Database Migration
- Add `source` and `github_url` columns to `tenant_templates` (with defaults so existing records unaffected)
- Add `source`, `author_tenant_id`, `author_name` columns to `templates`
- Create `marketplace_submissions` table
- All migrations are additive — no breaking changes to existing data

### 10.4. Security
- **Input validation:** GitHub URLs must be valid HTTPS GitHub URLs
- **CSS sanitization:** Same sanitization rules as platform templates (strip `@import`, `url()`, `expression()`)
- **S3 path injection:** Slug is sanitized (alphanumeric + hyphens only) before S3 path construction
- **Rate limiting:** Tenant upload limited to 10 uploads per hour
- **File size limits:** Individual files max 2MB, total template max 10MB
- **Tenant isolation:** Every S3 operation verifies `tenantId` in the path matches the authenticated user

### 10.5. Prisma Schema Additions

```prisma
model MarketplaceSubmission {
  id                String   @id @default(uuid())
  tenantId          String
  tenantTemplateId  String
  templateName      String
  description       String?
  category          String?
  tags              String[]
  stagingS3Path     String
  status            String   @default("pending")
  reviewerId        String?
  reviewerFeedback  String?
  reviewHistory     Json     @default("[]")
  approvedTemplateId String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  reviewedAt        DateTime?

  tenant          Tenant         @relation(fields: [tenantId], references: [id])
  tenantTemplate  TenantTemplate @relation(fields: [tenantTemplateId], references: [id])
  reviewer        User?          @relation(fields: [reviewerId], references: [id])
  approvedTemplate Template?     @relation(fields: [approvedTemplateId], references: [id])

  @@index([tenantId])
  @@index([status])
  @@map("marketplace_submissions")
}
```

## 11. Implementation Phases

### Phase 1: Tenant Upload (Core)
- [ ] DB migration: add `source`, `github_url` to `tenant_templates`
- [ ] Extract shared `validateTemplate()` from super admin upload
- [ ] Create `POST /api/tenant-admin/templates/upload` route
- [ ] Upload dialog component on tenant admin templates page
- [ ] Custom template badge on template cards
- [ ] S3 path: `tenants/{tenantId}/custom-templates/{slug}/`
- [ ] Verify activate/customize/delete work with custom templates

### Phase 2: Template Management
- [ ] Create `POST /api/tenant-admin/templates/[id]/update-from-github` route
- [ ] "Update from GitHub" UI action
- [ ] Preview capability for draft templates
- [ ] Delete custom template (with S3 cleanup)

### Phase 3: Marketplace Submission
- [ ] DB migration: create `marketplace_submissions` table
- [ ] Create submission API routes (submit, withdraw, list)
- [ ] "Share to Marketplace" dialog
- [ ] Submission status badges on template cards
- [ ] Staging S3 path: `marketplace-submissions/{submissionId}/`

### Phase 4: Super Admin Review
- [ ] DB migration: add `source`, `author_tenant_id`, `author_name` to `templates`
- [ ] "Community Submissions" tab on super admin templates page
- [ ] Review detail view with file viewer
- [ ] Approve, Reject, Request Changes actions
- [ ] Edit & Approve with inline file editor
- [ ] Approved template published to marketplace S3 + DB

### Phase 5: Notifications & Polish
- [ ] In-app notifications for submission status changes
- [ ] Super admin dashboard badge for pending submissions
- [ ] Marketplace attribution display ("By {author}")
- [ ] Marketplace source filter (Platform / Community)
- [ ] Staging S3 cleanup job (30-day expiry for rejected submissions)

## 12. Success Metrics

- **Adoption:** 20%+ of active tenants upload at least one custom template within 3 months
- **Marketplace Growth:** 10+ community templates submitted within 3 months
- **Approval Rate:** 50%+ of submissions approved (indicates clear guidelines)
- **Review Turnaround:** Average review time < 48 hours
- **Zero Cross-Tenant Leaks:** No tenant can access another tenant's custom template files

## 13. Open Questions

1. **Template guidelines:** Should we publish a "Template Submission Guide" for tenants to improve submission quality?
   - **Recommendation:** Yes, add a help link in the submission dialog pointing to docs.

2. **Submission limits:** Should there be a maximum number of pending submissions per tenant?
   - **Recommendation:** Cap at 5 pending submissions per tenant.

3. **Re-submission cooldown:** After rejection, should there be a cooldown before re-submitting?
   - **Recommendation:** No cooldown — the tenant needs to make changes anyway.

4. **Marketplace removal by tenant request:** Can a tenant request removal of their approved marketplace template?
   - **Recommendation:** Yes, but via support request to super admin (no self-service removal of marketplace templates).

5. **Staging cleanup:** How long should rejected/withdrawn submission files remain in S3?
   - **Recommendation:** 30 days, then auto-delete via S3 lifecycle policy.

6. **Template naming conflicts:** What if a community template slug conflicts with an existing marketplace template?
   - **Recommendation:** Super admin resolves by renaming the slug during Edit & Approve.

---

**Document Status:** Ready for Review
**Created:** 2026-02-13
**Last Updated:** 2026-02-13
**Version:** 1.0
**Author:** Claude (AI Assistant)
**Approved By:** [Pending]
