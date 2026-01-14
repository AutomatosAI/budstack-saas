import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TenantAdminSidebar } from "@/components/admin/TenantAdminSidebar";
import { AccessibleAdminLayout } from "@/components/admin/AccessibleAdminLayout";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { generateMockNotifications } from "@/lib/mock-data";

export default async function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !session.user?.id ||
    (session.user.role !== "TENANT_ADMIN" &&
      session.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: {
      tenants: true,
    },
  });

  if (!user?.tenants) {
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
        userName={session.user.name || "Tenant Admin"}
        userEmail={session.user.email || ""}
        tenantName={user.tenants.businessName}
      />
      <AccessibleAdminLayout theme="tenant-admin">
        {/* Notification bar - compact */}
        <div className="sticky top-0 z-30 flex items-center justify-end px-8 py-2">
          <NotificationCenter
            theme="tenant-admin"
            notifications={mockNotifications}
            viewAllUrl="/tenant-admin/notifications"
          />
        </div>
        {/* Main content */}
        <div className="flex-1 overflow-auto px-8 py-6">{children}</div>
      </AccessibleAdminLayout>
    </div>
  );
}
