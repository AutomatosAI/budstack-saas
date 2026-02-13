# PRD: User & Tenant Management System

## 1. Introduction
A comprehensive management system granting Super Admins, Tenant Admins, and Customers the ability to view and modify their respective data scopes. This establishes the hierarchy for the SaaS platform and ensures GDPR compliance.

## 2. Goals
- **Super Admin Control:** Full lifecycle management of Tenants (onboarding, editing, offboarding).
- **Tenant Control:** Management of their Customer base (viewing profiles, handling GDPR requests).
- **Customer Autonomy:** Self-service profile management (Password, Contact Info).
- **Data Segregation:** Strict boundaries—Super Admins manage Tenants; Tenant Admins manage Customers; Dr. Green manages payments/orders.

## 3. User Stories

### 3.1. Super Admin (Platform Level)

#### US-001: Manage Tenant Profile
**Description:** As a Super Admin, I need to update a Tenant's business details if they change.
**Acceptance Criteria:**
- [ ] Edit Form: Business Name, Subdomain, Country, Contact Email.
- [ ] Actions: "Reset Admin Password" (sends email), "Deactivate Tenant" (Access toggle).

#### US-002: Tenant Lifecycle
**Description:** As a Super Admin, I need to onboard new tenants or suspend bad actors.
**Acceptance Criteria:**
- [ ] "Create Tenant" wizard (Basic Info + Admin User).
- [ ] Toggle `isActive` status (Instant platform lock-out).

### 3.2. Tenant Admin (Store Level)

#### US-003: Customer List View
**Description:** As a Tenant Admin, I want to see who has registered on my store.
**Acceptance Criteria:**
- [x] Data Table: Name, Email, Registration Date, Status.
- [x] Search/Filter by Name or Email.
- [x] **Constraint:** Only show users linked to `tenantId`.

#### US-004: Edit Customer Profile
**Description:** As a Tenant Admin, I need to fix a typo in a customer's phone number or address.
**Acceptance Criteria:**
- [x] Edit Modal: First Name, Last Name, Phone, Address.
- [x] **Excluded:** Password (reset link only), Medical History (Read-only).
- [x] Read-only view of Orders (fetched from Dr. Green integration).

#### US-005: GDPR Deletion Request
**Description:** As a Tenant Admin, I must comply when a user asks to be "forgotten".
**Acceptance Criteria:**
- [x] "Delete User" Action.
- [x] **Implementation:** Hard delete or full anonymization of PII in `User` table.
- [x] *Note:* Order history remains in Dr. Green (external system), so we can safely wipe BudStack user records.

### 3.3. Customer (End User)

#### US-006: My Profile (Dashboard)
**Description:** As a Customer, I want to update my own address or password.
**Acceptance Criteria:**
- [x] Profile Settings Page: Update Name, Phone, Address.
- [x] "Change Password" flow (Old Password -> New Password).
- [x] View list of past orders (Read-only).

## 4. Functional Requirements

### 4.1. Data Scope
- **Medical Data:** STRICT READ-ONLY for Admins. If a patient's condition changes, they must submit a **New Consultation**. Admins cannot manually edit answers to medical questions to prevent liability/compliance issues.
- **Financial Data:** Not stored in BudStack. Order Views are projections from the Dr. Green API/Integration.

### 4.2. Security
- **Identity Access Management (IAM):**
    - `SUPER_ADMIN` can access `/super-admin/*` and all API routes.
    - `TENANT_ADMIN` can access `/tenant-admin/*` (scoped to their `tenantId`).
    - `PATIENT` can access `/store/[slug]/dashboard/*` (scoped to their `userId`).
- **Reset Password:** Never manual. Always via secure, time-limited token email.

## 5. Non-Goals
- **Impersonation:** Super Admins will not "Log in as Tenant" in this phase.
- **Order Editing:** Modification of line items/refunds must happen in the Dr. Green console, not BudStack.

## 6. Technical Considerations
- **Audit Logs:** All Admin actions (Update Tenant, Delete User) must be logged to `AuditLog` table for compliance.
- **Performance:** Customer lists should be paginated server-side (server actions).

## 7. Success Metrics
- **Support Reduction:** Tenants can solve 90% of "Change my address" requests without contacting Super Admins.
- **Compliance:** 100% of GDPR deletion requests are processed successfully within the platform.
