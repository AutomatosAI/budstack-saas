import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SuperAdminSidebar } from '@/components/admin/SuperAdminSidebar';
import { AccessibleAdminLayout } from '@/components/admin/AccessibleAdminLayout';

export default async function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'SUPER_ADMIN') {
        redirect('/auth/login');
    }

    return (
        <div className="flex h-screen bg-gray-50 theme-force-light">
            <SuperAdminSidebar
                userName={session.user.name || 'Super Admin'}
                userEmail={session.user.email || 'admin@budstack.io'}
            />
            <AccessibleAdminLayout theme="super-admin">
                <div className="flex-1 overflow-auto pl-0 md:pl-0">
                    {children}
                </div>
            </AccessibleAdminLayout>
        </div>
    );
}
