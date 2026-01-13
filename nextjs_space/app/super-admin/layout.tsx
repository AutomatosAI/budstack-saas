import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SuperAdminSidebar } from "@/components/admin/SuperAdminSidebar";
import { AccessibleAdminLayout } from "@/components/admin/AccessibleAdminLayout";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { generateMockNotifications } from "@/lib/mock-data";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  // Generate mock notifications for demo (replace with real data in production)
  const mockNotifications = generateMockNotifications(8);

  return (
    <div className="flex h-screen bg-gray-50 theme-force-light">
      <SuperAdminSidebar
        userName={session.user.name || "Super Admin"}
        userEmail={session.user.email || "admin@budstack.io"}
      />
      <AccessibleAdminLayout theme="super-admin">
        {/* Header with notification center */}
        <div className="sticky top-0 z-30 flex items-center justify-end px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
          <NotificationCenter
            theme="super-admin"
            notifications={mockNotifications}
            viewAllUrl="/super-admin/notifications"
          />
        </div>
        <div className="flex-1 overflow-auto pl-0 md:pl-0">{children}</div>
      </AccessibleAdminLayout>
    </div>
  );
}
