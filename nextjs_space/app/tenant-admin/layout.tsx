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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Tenant Associated</h1>
          <p className="text-gray-600">
            Your account is not associated with any tenant.
          </p>
        </div>
      </div>
    );
  }

  // Generate mock notifications for demo (replace with real data in production)
  const mockNotifications = generateMockNotifications(8);

  return (
    <div className="flex h-screen bg-gray-50 theme-force-light">
      <TenantAdminSidebar
        userName={session.user.name || "Tenant Admin"}
        userEmail={session.user.email || ""}
        tenantName={user.tenants.businessName}
      />
      <AccessibleAdminLayout theme="tenant-admin">
        {/* Header with notification center */}
        <div className="sticky top-0 z-30 flex items-center justify-end px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
          <NotificationCenter
            theme="tenant-admin"
            notifications={mockNotifications}
            viewAllUrl="/tenant-admin/notifications"
          />
        </div>
        <div className="flex-1 overflow-auto pl-0 md:pl-0">{children}</div>
      </AccessibleAdminLayout>
    </div>
  );
}
