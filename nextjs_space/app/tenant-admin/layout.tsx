import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TenantAdminSidebar } from "@/components/admin/TenantAdminSidebar";
import { AccessibleAdminLayout } from "@/components/admin/AccessibleAdminLayout";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { generateMockNotifications } from "@/lib/mock-data";

import { HeaderProfile } from "@/components/admin/HeaderProfile";

export default async function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (
    !user ||
    (user.publicMetadata.role !== "TENANT_ADMIN" &&
      user.publicMetadata.role !== "SUPER_ADMIN")
  ) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    include: {
      tenants: {
        select: {
          id: true,
          businessName: true,
        },
      },
    },
  });

  if (!localUser?.tenants) {
    return (
      <div className="min-h-screen canvas-bg flex items-center justify-center">
        <div className="card-floating p-10 text-center max-w-md">
          <h1 className="font-display text-2xl font-bold text-foreground mb-4">
            No Tenant Associated
          </h1>
          <p className="text-muted-foreground">
            Your account is not associated with any tenant.
          </p>
        </div>
      </div>
    );
  }

  // Generate mock notifications for demo
  const mockNotifications = generateMockNotifications(8);

  return (
    <div className="flex min-h-screen canvas-bg">
      <TenantAdminSidebar
        userName={`${user.firstName || ""} ${user.lastName || ""}`.trim() || "Tenant Admin"}
        userEmail={user.emailAddresses[0]?.emailAddress || ""}
        tenantName={localUser.tenants.businessName || "My Store"}
      />
      <AccessibleAdminLayout theme="tenant-admin">
        {/* Notification bar - compact */}
        <div className="sticky top-0 z-30 flex items-center justify-end px-8 py-2">
          <NotificationCenter
            theme="tenant-admin"
            notifications={mockNotifications}
            viewAllUrl="/tenant-admin/notifications"
          />
          <HeaderProfile theme="tenant-admin" />
        </div>
        {/* Main content */}
        <div className="flex-1 overflow-auto px-8 py-6">{children}</div>
      </AccessibleAdminLayout>
    </div>
  );
}
