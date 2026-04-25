import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SuperAdminSidebar } from "@/components/admin/SuperAdminSidebar";
import { SuperAdminSidebarV2 } from "@/components/admin/v2/SuperAdminSidebarV2";
import { AccessibleAdminLayout } from "@/components/admin/AccessibleAdminLayout";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import type {
  Notification,
  NotificationType,
} from "@/components/admin/NotificationCenter";

import { HeaderProfile } from "@/components/admin/HeaderProfile";
import { HeaderProfileV2 } from "@/components/admin/v2/HeaderProfileV2";
import { ADMIN_CHROME_VERSION } from "@/lib/admin-chrome";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
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

  const userName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Super Admin";
  const userEmail =
    user.emailAddresses[0]?.emailAddress || "admin@budstack.io";

  const isV2 = ADMIN_CHROME_VERSION === "v2";

  return (
    <div
      className={
        isV2
          ? "flex min-h-screen bg-bs-bg-1"
          : "flex min-h-screen canvas-bg"
      }
      data-admin-chrome={ADMIN_CHROME_VERSION}
    >
      {isV2 ? (
        <SuperAdminSidebarV2 userName={userName} userEmail={userEmail} />
      ) : (
        <SuperAdminSidebar userName={userName} userEmail={userEmail} />
      )}
      <AccessibleAdminLayout theme="super-admin">
        {/* Top bar */}
        <div
          className={
            isV2
              ? "sticky top-0 z-30 flex items-center justify-end px-4 py-2 md:px-8 bg-bs-bg-0 border-b border-bs-border budstacks-theme"
              : "sticky top-0 z-30 flex items-center justify-end px-4 py-2 md:px-8"
          }
        >
          <NotificationCenter
            theme="super-admin"
            notifications={notifications}
            viewAllUrl="/super-admin/notifications"
          />
          {isV2 ? (
            <HeaderProfileV2 theme="super-admin" />
          ) : (
            <HeaderProfile theme="super-admin" />
          )}
        </div>
        {/* Main content */}
        <div className="flex-1 overflow-auto px-4 py-4 md:px-8 md:py-6">{children}</div>
      </AccessibleAdminLayout>
    </div>
  );
}
