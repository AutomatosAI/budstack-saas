# PRD: Email System (Phase 1 - SMTP & Observability)

## 1. Introduction
Implement a robust, multi-tenant email delivery system driven by "Bring Your Own" (BYO) SMTP configurations. The system will use **React Email** for high-quality templates, **Redis + BullMQ** for reliable queuing, and strictly adhere to global compliance standards from day one.

## 2. Goals
- **Reliability:** Ensure emails are delivered asynchronously via a durable queue (BullMQ), decoupling sending from the user request loop.
- **Tenant Autonomy:** Tenants configure their own SMTP settings (e.g., Gmail, Outlook, Custom generic SMTP).
- **Observability:** Provide tenants with detailed logs of every email sent (or failed) with exact SMTP error messages.
- **Standardization:** Use React Email to maintain high design standards while allowing basic tenant branding (Logo/Colors).
- **Compliance:** Built-in "Strict Mode" for headers (List-Unsubscribe), consent tracking, and unsubscribe flows to support future EU/US expansion.

## 3. User Stories

### US-001: Configure Tenant SMTP
**Description:** As a Tenant Admin, I need to enter my SMTP credentials so that the platform can send emails on my behalf.

**Acceptance Criteria:**
- [ ] UI for entering Host, Port, Secure (TLS/SSL), Username, Password.
- [ ] **"Test Connection"** button: Attempts a real handshake and sends a test email to the admin.
- [ ] Credentials are stored **encrypted** in the database.
- [ ] Validation: Block common insecure ports (25) if necessary; warn about Gmail app passwords.

### US-002: System Sends Transactional Emails (Queued)
**Description:** As a User, when I request a password reset, I expect to receive the email reliably, even if the system is under load.

**Acceptance Criteria:**
- [ ] Application pushes job to `email-queue` (Redis).
- [ ] Worker processes job: Decrypts tenant SMTP -> Renders React Template -> Sends via Nodemailer.
- [ ] Retries: Automatic exponential backoff for transient errors (e.g., network timeout).
- [ ] Hard Failures: Capture exact SMTP error (e.g., "535 Authentication Failed") and stop retries.

### US-003: Email Activity Log
**Description:** As a Tenant Admin, I want to see a log of all emails sent to debug issues (e.g., "Why didn't my customer get their invoice?").

**Acceptance Criteria:**
- [ ] Table view: Recipient, Subject, Template Type, Status (Queued/Sent/Failed), Timestamp.
- [ ] Detail view: Show full SMTP response/error message.
- [ ] Filter by status and date.

### US-005: Template Management (Super Admin)
**Description:** As a Super Admin, I want to view, edit, and create email templates using a visual editor so I can maintain high-quality system notifications.

**Acceptance Criteria:**
- [ ] List View: Show all system templates (Welcome, Reset Password, etc.).
- [ ] Editor: Visual interface to edit subject, body content (HTML/React), and preview.
- [ ] Variables: Show available variables for each template type (e.g., `{{name}}`, `{{link}}`).
- [ ] **Technical Note:** Build `EmailTemplateList` and `EmailEditor` as **Shared Components** to be reused for Tenant Admins in Phase 2.

### US-006: Event Mapping
**Description:** As a System Admin, I want to map specific system events to specific templates so I can control which email sends when.

**Acceptance Criteria:**
- [ ] Mapping UI: "On Event [User Signup] -> Send Template [Welcome Email v1]".
- [ ] storage: `email_events` table mapping `eventType` to `templateId`.

### Phase 2 Preparation (Tenant Reuse)
**Strategic Goal:** All components built for Super Admin email management must be designed for multi-tenancy from day one.
- **Shared Components:** The `EmailEditor` and `TemplateList` must accept a `tenantId` prop (optional). If provided, it filters/scoping to that tenant. If null, it acts as Super Admin.
- **Security:** Ensure API routes check permissions. Super Admin can edit ALL. Tenant Admin can only edit THEIR templates (where `template.tenantId == user.tenantId`).

## 4. Functional Requirements

### 4.1. Core Service
- **`MailerService`**: Interface for queuing emails.
    - `send(tenantId, template: string, data: object, recipient: string)`
- **`EmailWorker`**: Background processor.
    - Configures Nodemailer transport *per job* using tenant's decrypted credentials.

### 4.2. Template Engine (React Email)
Standardize on the following system templates for Phase 1:
1.  **Welcome / Verify Email**
2.  **Password Reset**
3.  **User Invitation**
4.  **Order Confirmation** (Dr. Green / E-commerce)
5.  **Invoice / Receipt**
6.  **Subscription Status** (Upgraded/Cancelled)

### 4.3. Queuing (BullMQ)
- **Queue Name:** `email-sending`
- **Concurrency:** Limited per tenant to prevent "noisy neighbor" IP throttling (e.g., 5 concurrent sends per tenant).
- **Retention:** Keep job history for 7 days in Redis (for debugging queue state).

### 4.4. Compliance (Global Strict)
- **Headers:** Every email must include `List-Unsubscribe` headers.
- **Footer:** Mandatory physical address and "Unsubscribe" link (even for transactional, if strictly interpreted, but definitely for "updates").
- **Consent:** DB model `EmailConsent` to track opt-in/opt-out per category (Marketing vs. Transactional).

## 5. Non-Goals
- **WYSIWYG Editor:** No custom HTML editing for tenants in Phase 1.
- **Marketing Campaigns:** This is for transactional/notification emails only; no bulk newsletter features.
- **Managed Sending:** We do not provide a "budstack.com" mail server yet; tenants *must* bring their own.

## 6. Technical Considerations
- **Security:** SMTP passwords must use AES-256 encryption at rest. Use `crypto` module or Prisma middleware.
- **Dependencies:** `bullmq`, `ioredis`, `@react-email/components`.
- **Infrastructure:** Requires a Redis instance (already available in stack).

## 7. Success Metrics
- **Delivery Rate:** >98% of valid SMTP configurations successfully send.
- **Visibility:** 100% of failed sends are logged with a human-readable error for the tenant.
- **Performance:** Emails queued and processed within < 5 seconds.

## 8. Open Questions
- **Handling Rate Limits:** If a tenant hits their Gmail daily limit (500/day), how do we handle the backlog? *Decision: Fail the jobs with "Quota Exceeded" error after max retries.*
