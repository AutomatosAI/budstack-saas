import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TenantAdminSidebar } from "@/components/admin/TenantAdminSidebar";
import { AccessibleAdminLayout } from "@/components/admin/AccessibleAdminLayout";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import crypto from "crypto";

import { HeaderProfile } from "@/components/admin/HeaderProfile";

export default async function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    console.warn("[tenant-admin] REJECTED — no Clerk user found, redirecting to login");
    redirect("/auth/login");
  }

  if (
    user.publicMetadata.role !== "TENANT_ADMIN" &&
    user.publicMetadata.role !== "SUPER_ADMIN"
  ) {
    const rejectedEmail = user.emailAddresses[0]?.emailAddress;
    console.warn(
      `[tenant-admin] REJECTED — email: ${rejectedEmail}, clerkId: ${user.id}, role: "${user.publicMetadata.role}", metadata: ${JSON.stringify(user.publicMetadata)}`
    );
    redirect("/auth/login");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  console.log("[tenant-admin] Clerk user:", user.id, "email:", email, "role:", user.publicMetadata.role, "tenantId:", user.publicMetadata.tenantId);

  // Try email-based lookup first
  let localUser = await prisma.users.findFirst({
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

  console.log("[tenant-admin] DB user lookup by email:", email, "found:", !!localUser, "tenantId:", localUser?.tenantId, "tenant:", localUser?.tenants?.businessName);

  // Fallback: if no DB user found by email, try resolving via Clerk org ID
  if (!localUser?.tenants && user.publicMetadata.tenantId) {
    const clerkOrgId = user.publicMetadata.tenantId as string;
    console.log("[tenant-admin] Trying Clerk org ID fallback:", clerkOrgId);
    try {
      const tenantByOrg = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM tenants WHERE settings->>'clerkOrgId' = ${clerkOrgId} LIMIT 1
      `;
      if (tenantByOrg?.length > 0) {
        console.log("[tenant-admin] Found tenant by org ID:", tenantByOrg[0].id);
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
        console.log("[tenant-admin] Self-healed DB user for:", email);
      }
    } catch (err) {
      console.error("[tenant-admin] Org ID fallback failed:", err);
    }
  }

  if (!localUser?.tenants) {
    console.error("[tenant-admin] No tenant found for user:", email, "Clerk ID:", user.id);
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

  return (
    <div data-surface="admin" data-tier="tenant" className="budstacks-theme flex min-h-screen canvas-bg">
      <TenantAdminSidebar
        userName={`${user.firstName || ""} ${user.lastName || ""}`.trim() || "Tenant Admin"}
        userEmail={user.emailAddresses[0]?.emailAddress || ""}
        tenantName={localUser.tenants.businessName || "My Store"}
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
        {/* Main content — 1800px max with responsive 16→32px side padding, 56px top */}
        <div className="flex-1 overflow-auto px-4 md:px-8 pt-14 pb-10">
          <div className="mx-auto max-w-[1800px]">{children}</div>
        </div>
      </AccessibleAdminLayout>
    </div>
  );
}
