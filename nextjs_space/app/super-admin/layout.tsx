import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SuperAdminSidebar } from "@/components/admin/SuperAdminSidebar";
import { AccessibleAdminLayout } from "@/components/admin/AccessibleAdminLayout";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import type {
  Notification,
  NotificationType,
} from "@/components/admin/NotificationCenter";

import { HeaderProfile } from "@/components/admin/HeaderProfile";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/sign-in");
  }

  const mapActionToType = (action: string): NotificationType => {
    if (action.includes("FAILED")) return "FAILED_ORDER";
    if (action.includes("LOW_STOCK")) return "LOW_STOCK";
    if (action.includes("ALERT")) return "SYSTEM_ALERT";
    if (action.includes("TENANT") || action.includes("APPROVAL")) {
      return "PENDING_APPROVAL";
    }
    return "USER_ACTION";
  };

  let notifications: Notification[] = [];
  try {
    const auditLogs = await prisma.audit_logs.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    notifications = auditLogs.map((log: (typeof auditLogs)[0]) => ({
      id: log.id,
      type: mapActionToType(log.action),
      title: log.action.replace(/_/g, " "),
      message: log.entityType
        ? `${log.entityType}${log.entityId ? ` (${log.entityId})` : ""}`
        : "System event",
      timestamp: log.createdAt,
      isRead: false,
      actionUrl: log.entityId
        ? `/super-admin/audit-logs?entityId=${log.entityId}`
        : undefined,
    }));
  } catch (error) {
    console.error("[SuperAdminLayout] Failed to load notifications:", error);
  }

  return (
    <div className="flex min-h-screen canvas-bg">
      <SuperAdminSidebar
        userName={`${user.firstName || ""} ${user.lastName || ""}`.trim() || "Super Admin"}
        userEmail={user.emailAddresses[0]?.emailAddress || "admin@budstack.io"}
      />
      <AccessibleAdminLayout theme="super-admin">
        {/* Notification bar - compact */}
        <div className="sticky top-0 z-30 flex items-center justify-end px-8 py-2">
          <NotificationCenter
            theme="super-admin"
            notifications={notifications}
            viewAllUrl="/super-admin/notifications"
          />
          <HeaderProfile theme="super-admin" />
        </div>
        {/* Main content */}
        <div className="flex-1 overflow-auto px-8 py-6">{children}</div>
      </AccessibleAdminLayout>
    </div>
  );
}
