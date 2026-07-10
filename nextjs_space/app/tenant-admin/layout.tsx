import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TenantAdminSidebar } from "@/components/admin/TenantAdminSidebar";
import { AccessibleAdminLayout } from "@/components/admin/AccessibleAdminLayout";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import crypto from "crypto";
import { logger } from "@/lib/logger";

import { HeaderProfile } from "@/components/admin/HeaderProfile";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { resolveUserPermissions } from "@/lib/permissions/current-user-permissions";
import { resolveActiveImpersonation } from "@/lib/impersonation/resolve";
import type { ActiveImpersonation } from "@/lib/impersonation/resolve";

export default async function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    logger.warn("[tenant-admin] REJECTED — no Clerk user found, redirecting to login");
    redirect("/auth/login");
  }

  if (
    user.publicMetadata.role !== "TENANT_ADMIN" &&
    user.publicMetadata.role !== "SUPER_ADMIN"
  ) {
    // AC-2b: log the Clerk user id + role only — never the admin email or the
    // raw publicMetadata (which can carry PII-adjacent fields).
    logger.warn("[tenant-admin] REJECTED — insufficient role", {
      clerkId: user.id,
      role: String(user.publicMetadata.role),
      tenantId: user.publicMetadata.tenantId,
    });
    redirect("/auth/login");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  // AC-2b: Clerk user id + tenant id only — never the admin email.
  logger.info("[tenant-admin] Clerk user resolved", {
    clerkId: user.id,
    role: String(user.publicMetadata.role),
    tenantId: user.publicMetadata.tenantId,
  });

  // PRD-302: an impersonating super-admin renders this layout as the TARGET
  // tenant. Identity stays their own (audit rows record the real actor); only
  // the tenant binding changes. resolveActiveImpersonation is fail-closed —
  // ended/expired/foreign cookies and non-super-admin roles all resolve to
  // null and fall through to the normal lookup below.
  const impersonation: ActiveImpersonation | null =
    user.publicMetadata.role === "SUPER_ADMIN"
      ? await resolveActiveImpersonation(user.id)
      : null;

  const impersonatedTenant = impersonation
    ? await prisma.tenants.findFirst({
        where: { id: impersonation.tenantId },
        select: {
          id: true,
          businessName: true,
          automatosApiKey: true,
          automatosAgentId: true,
        },
      })
    : null;

  // Try email-based lookup first (skipped while impersonating — the super-admin
  // may have no tenant-linked users row, and must not self-heal one below)
  let localUser: any = null;
  if (!impersonatedTenant) {
    localUser = await prisma.users.findFirst({
      where: { email: email },
      include: {
        tenants: {
          select: {
            id: true,
            businessName: true,
            automatosApiKey: true,
            automatosAgentId: true,
          },
        },
      },
    });

    logger.info("[tenant-admin] DB user lookup", {
      clerkId: user.id,
      found: !!localUser,
      tenantId: localUser?.tenantId,
    });
  }

  // Fallback: if no DB user found by email, try resolving via Clerk org ID
  if (!impersonatedTenant && !localUser?.tenants && user.publicMetadata.tenantId) {
    const clerkOrgId = user.publicMetadata.tenantId as string;
    logger.info("[tenant-admin] Trying Clerk org ID fallback", { clerkOrgId });
    try {
      const tenantByOrg = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM tenants WHERE settings->>'clerkOrgId' = ${clerkOrgId} LIMIT 1
      `;
      if (tenantByOrg?.length > 0) {
        logger.info("[tenant-admin] Found tenant by org ID", { tenantId: tenantByOrg[0].id });
        // Create or update the DB user to link them
        localUser = await prisma.users.upsert({
          where: { email: email! },
          update: { tenantId: tenantByOrg[0].id, role: "TENANT_ADMIN", updatedAt: new Date() },
          create: {
            id: crypto.randomUUID(),
            email: email!,
            password: "CLERK_MANAGED_ACCOUNT",
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Admin",
            role: "TENANT_ADMIN",
            tenantId: tenantByOrg[0].id,
            updatedAt: new Date(),
          },
          include: {
            tenants: {
              select: {
                id: true,
                businessName: true,
                automatosApiKey: true,
                automatosAgentId: true,
              }
            }
          },
        });
        logger.info("[tenant-admin] Self-healed DB user", {
          clerkId: user.id,
          tenantId: tenantByOrg[0].id,
        });
      }
    } catch (err) {
      logger.error("[tenant-admin] Org ID fallback failed", {
        clerkId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // The tenant this layout renders: the impersonated tenant when a session is
  // live, otherwise the admin's own (via users-row / org-id lookup above).
  const activeTenant = impersonatedTenant ?? localUser?.tenants ?? null;

  if (!activeTenant) {
    logger.error("[tenant-admin] No tenant found for user", { clerkId: user.id });
    return (
      <div data-surface="admin" data-tier="tenant" className="budstacks-theme min-h-screen canvas-bg flex items-center justify-center">
        <div className="card-floating p-10 text-center max-w-md">
          <h1 className="font-display text-2xl font-bold text-foreground mb-4">
            No Tenant Associated
          </h1>
          <p className="text-muted-foreground">
            Your account ({email}) is not associated with any tenant. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  // TODO: Replace with real notifications from DB
  const mockNotifications: Array<{ id: string; type: "SYSTEM_ALERT"; title: string; message: string; timestamp: Date; isRead: boolean }> = [];

  // PRD-301: resolve the admin's permissions to filter the sidebar nav. Fail-open
  // to a full nav on error — the pages/APIs enforce actual access.
  let sidebarPermissions;
  try {
    sidebarPermissions = (
      await resolveUserPermissions(
        { role: String(user.publicMetadata.role), email },
        activeTenant.id,
      )
    ).permissions;
  } catch (err) {
    logger.error("[tenant-admin] permission resolution failed", {
      clerkId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const shell = (
    <>
      <TenantAdminSidebar
        userName={`${user.firstName || ""} ${user.lastName || ""}`.trim() || "Tenant Admin"}
        userEmail={user.emailAddresses[0]?.emailAddress || ""}
        tenantName={activeTenant.businessName || "My Store"}
        permissions={sidebarPermissions}
      />
      <AccessibleAdminLayout theme="tenant-admin">
        {/* Top bar — Budstacks Admin DS: bg-bs-bg, hairline border, 56px */}
        <div className="sticky top-0 z-30 flex items-center justify-end h-14 px-4 md:px-8 bg-bs-bg border-b border-bs-border-100">
          <NotificationCenter
            theme="tenant-admin"
            notifications={mockNotifications}
            viewAllUrl="/tenant-admin/notifications"
          />
          <HeaderProfile theme="tenant-admin" />
        </div>
        {/* Main content — 1800px max with responsive 16→32px side padding, snug top */}
        <div className="flex-1 overflow-auto px-4 md:px-8 pt-6 pb-10">
          <div className="mx-auto max-w-[1800px]">{children}</div>
        </div>
      </AccessibleAdminLayout>
    </>
  );

  // PRD-302 AC-2: while impersonating, the red banner spans the full viewport
  // width ABOVE sidebar + navbar and cannot be dismissed. The non-impersonation
  // return below is byte-identical to the pre-PRD-302 layout.
  if (impersonation) {
    return (
      <div data-surface="admin" data-tier="tenant" className="budstacks-theme min-h-screen canvas-bg flex flex-col">
        <ImpersonationBanner
          sessionId={impersonation.sessionId}
          tenantName={activeTenant.businessName || impersonation.tenantBusinessName}
          tenantEmail={impersonation.tenantEmail}
          superAdminEmail={impersonation.superAdminEmail}
          startedAt={impersonation.startedAt.toISOString()}
          expiresAt={impersonation.expiresAt.toISOString()}
        />
        <div className="flex flex-1 min-h-0">{shell}</div>
      </div>
    );
  }

  return (
    <div data-surface="admin" data-tier="tenant" className="budstacks-theme flex min-h-screen canvas-bg">
      {shell}
    </div>
  );
}
