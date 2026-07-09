-- PRD-301 (Team Management & Role-Based Permissions) — Phase 1 foundation.
--
-- entrypoint.sh runs `prisma migrate deploy` on boot, which only APPLIES migration
-- files (it never diffs schema.prisma against the DB). This migration is therefore
-- hand-written and fully IDEMPOTENT (IF NOT EXISTS / ON CONFLICT DO NOTHING) so it
-- is safe to (re)apply on any environment — matching the PRD-213 migration pattern.
--
-- Backfill permission booleans below MUST mirror DEFAULT_PERMISSIONS in
-- lib/permissions/preset-roles.ts (the runtime source of truth for new tenants).

-- ── AlterTable: audit_logs — PRD-302 impersonation session linkage ──
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "impersonationSessionId" TEXT;
CREATE INDEX IF NOT EXISTS "audit_logs_impersonationSessionId_idx" ON "audit_logs"("impersonationSessionId");

-- ── AlterTable: users — PRD-301 team permission-set selector ──
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "teamRole" TEXT;

-- ── CreateTable: role_permissions ──
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "canViewCustomers" BOOLEAN NOT NULL DEFAULT false,
    "canEditCustomers" BOOLEAN NOT NULL DEFAULT false,
    "canExportCustomers" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteCustomer" BOOLEAN NOT NULL DEFAULT false,
    "canViewOrders" BOOLEAN NOT NULL DEFAULT false,
    "canEditOrders" BOOLEAN NOT NULL DEFAULT false,
    "canViewProducts" BOOLEAN NOT NULL DEFAULT false,
    "canEditProducts" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteProducts" BOOLEAN NOT NULL DEFAULT false,
    "canViewAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "canEditSettings" BOOLEAN NOT NULL DEFAULT false,
    "canManageBranding" BOOLEAN NOT NULL DEFAULT false,
    "canInviteTeamMembers" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteTeamMembers" BOOLEAN NOT NULL DEFAULT false,
    "canViewAuditLogs" BOOLEAN NOT NULL DEFAULT false,
    "canViewCRM" BOOLEAN NOT NULL DEFAULT false,
    "canViewEmails" BOOLEAN NOT NULL DEFAULT false,
    "canEditEmails" BOOLEAN NOT NULL DEFAULT false,
    "canViewTemplates" BOOLEAN NOT NULL DEFAULT false,
    "canEditTemplates" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "role_permissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_tenantId_role_key" ON "role_permissions"("tenantId", "role");
CREATE INDEX IF NOT EXISTS "role_permissions_tenantId_idx" ON "role_permissions"("tenantId");

-- ── CreateTable: team_invitations ──
CREATE TABLE IF NOT EXISTS "team_invitations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitationToken" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_invitations_invitationToken_key" ON "team_invitations"("invitationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "team_invitations_tenantId_email_key" ON "team_invitations"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "team_invitations_tenantId_status_idx" ON "team_invitations"("tenantId", "status");

-- ────────────────────────── PRD-301 Data Backfill ──────────────────────────

-- 1. Existing tenant admins become the always-all-permissions 'admin' team role.
UPDATE "users" SET "teamRole" = 'admin'
WHERE "role" = 'TENANT_ADMIN' AND "teamRole" IS NULL;

-- 2. Seed the default permission matrix for every existing tenant (5 preset roles).
--    Values mirror DEFAULT_PERMISSIONS in lib/permissions/preset-roles.ts.

-- admin: all permissions
INSERT INTO "role_permissions" (
  "id","tenantId","role",
  "canViewCustomers","canEditCustomers","canExportCustomers","canDeleteCustomer",
  "canViewOrders","canEditOrders","canViewProducts","canEditProducts","canDeleteProducts",
  "canViewAnalytics","canEditSettings","canManageBranding","canInviteTeamMembers",
  "canDeleteTeamMembers","canViewAuditLogs","canViewCRM","canViewEmails","canEditEmails",
  "canViewTemplates","canEditTemplates","createdAt","updatedAt")
SELECT gen_random_uuid(), t."id", 'admin',
  true,true,true,true, true,true,true,true,true, true,true,true,true,
  true,true,true,true,true, true,true, now(), now()
FROM "tenants" t
ON CONFLICT ("tenantId","role") DO NOTHING;

-- editor: view/edit products & templates, view orders, view CRM
INSERT INTO "role_permissions" (
  "id","tenantId","role",
  "canViewCustomers","canEditCustomers","canExportCustomers","canDeleteCustomer",
  "canViewOrders","canEditOrders","canViewProducts","canEditProducts","canDeleteProducts",
  "canViewAnalytics","canEditSettings","canManageBranding","canInviteTeamMembers",
  "canDeleteTeamMembers","canViewAuditLogs","canViewCRM","canViewEmails","canEditEmails",
  "canViewTemplates","canEditTemplates","createdAt","updatedAt")
SELECT gen_random_uuid(), t."id", 'editor',
  false,false,false,false, true,false,true,true,false, false,false,false,false,
  false,false,true,false,false, true,true, now(), now()
FROM "tenants" t
ON CONFLICT ("tenantId","role") DO NOTHING;

-- customer_support: view/export/delete customers, view orders, view CRM
INSERT INTO "role_permissions" (
  "id","tenantId","role",
  "canViewCustomers","canEditCustomers","canExportCustomers","canDeleteCustomer",
  "canViewOrders","canEditOrders","canViewProducts","canEditProducts","canDeleteProducts",
  "canViewAnalytics","canEditSettings","canManageBranding","canInviteTeamMembers",
  "canDeleteTeamMembers","canViewAuditLogs","canViewCRM","canViewEmails","canEditEmails",
  "canViewTemplates","canEditTemplates","createdAt","updatedAt")
SELECT gen_random_uuid(), t."id", 'customer_support',
  true,false,true,true, true,false,false,false,false, false,false,false,false,
  false,false,true,false,false, false,false, now(), now()
FROM "tenants" t
ON CONFLICT ("tenantId","role") DO NOTHING;

-- web_designer: edit templates & branding, view products
INSERT INTO "role_permissions" (
  "id","tenantId","role",
  "canViewCustomers","canEditCustomers","canExportCustomers","canDeleteCustomer",
  "canViewOrders","canEditOrders","canViewProducts","canEditProducts","canDeleteProducts",
  "canViewAnalytics","canEditSettings","canManageBranding","canInviteTeamMembers",
  "canDeleteTeamMembers","canViewAuditLogs","canViewCRM","canViewEmails","canEditEmails",
  "canViewTemplates","canEditTemplates","createdAt","updatedAt")
SELECT gen_random_uuid(), t."id", 'web_designer',
  false,false,false,false, false,false,true,false,false, false,false,true,false,
  false,false,false,false,false, true,true, now(), now()
FROM "tenants" t
ON CONFLICT ("tenantId","role") DO NOTHING;

-- manager: view analytics, orders, customers (read-only), manage emails
INSERT INTO "role_permissions" (
  "id","tenantId","role",
  "canViewCustomers","canEditCustomers","canExportCustomers","canDeleteCustomer",
  "canViewOrders","canEditOrders","canViewProducts","canEditProducts","canDeleteProducts",
  "canViewAnalytics","canEditSettings","canManageBranding","canInviteTeamMembers",
  "canDeleteTeamMembers","canViewAuditLogs","canViewCRM","canViewEmails","canEditEmails",
  "canViewTemplates","canEditTemplates","createdAt","updatedAt")
SELECT gen_random_uuid(), t."id", 'manager',
  true,false,false,false, true,false,false,false,false, true,false,false,false,
  false,false,false,true,true, false,false, now(), now()
FROM "tenants" t
ON CONFLICT ("tenantId","role") DO NOTHING;
