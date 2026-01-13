import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SuperAdminSidebar } from '@/components/admin/SuperAdminSidebar';
import { AccessibleAdminLayout } from '@/components/admin/AccessibleAdminLayout';
import { NotificationCenter } from '@/components/admin/NotificationCenter';
import type { Notification, NotificationType } from '@/components/admin/NotificationCenter';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

    const mapActionToType = (action: string): NotificationType => {
        if (action.includes('FAILED')) return 'FAILED_ORDER';
        if (action.includes('LOW_STOCK')) return 'LOW_STOCK';
        if (action.includes('ALERT')) return 'SYSTEM_ALERT';
        if (action.includes('TENANT') || action.includes('APPROVAL')) return 'PENDING_APPROVAL';
        return 'USER_ACTION';
    };

    let notifications: Notification[] = [];
    try {
        const auditLogs = await prisma.audit_logs.findMany({
            orderBy: { createdAt: 'desc' },
            take: 8,
        });

        notifications = auditLogs.map((log) => ({
            id: log.id,
            type: mapActionToType(log.action),
            title: log.action.replace(/_/g, ' '),
            message: log.entityType ? `${log.entityType}${log.entityId ? ` (${log.entityId})` : ''}` : 'System event',
            timestamp: log.createdAt,
            isRead: false,
            actionUrl: log.entityId ? `/super-admin/audit-logs?entityId=${log.entityId}` : undefined,
        }));
    } catch (error) {
        console.error('[SuperAdminLayout] Failed to load notifications:', error);
    }

    return (
        <div className="flex h-screen bg-gray-50 theme-force-light">
            <SuperAdminSidebar
                userName={session.user.name || 'Super Admin'}
                userEmail={session.user.email || 'admin@budstack.io'}
            />
            <AccessibleAdminLayout theme="super-admin">
                {/* Header with notification center */}
                <div className="sticky top-0 z-30 flex items-center justify-end px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
                    <NotificationCenter
                        theme="super-admin"
                        notifications={notifications}
                        viewAllUrl="/super-admin/notifications"
                    />
                </div>
                <div className="flex-1 overflow-auto pl-0 md:pl-0">
                    {children}
                </div>
            </AccessibleAdminLayout>
        </div>
        <div className="flex-1 overflow-auto pl-0 md:pl-0">{children}</div>
      </AccessibleAdminLayout>
    </div>
  );
}
