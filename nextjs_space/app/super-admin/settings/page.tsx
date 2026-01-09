
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import SettingsForm from './settings-form';
import { Breadcrumbs } from '@/components/admin/shared';

export default async function PlatformSettingsConfigPage() {
    const session = await getServerSession();

    if (!session?.user?.email) {
        redirect('/auth/login');
    }

    const user = await prisma.users.findUnique({
        where: { email: session.user.email },
    });

    if (user?.role !== 'SUPER_ADMIN') {
        redirect('/dashboard');
    }

    // Get or create platform config
    let config = await prisma.platform_config.findUnique({
        where: { id: 'config' },
    });

    if (!config) {
        config = await prisma.platform_config.create({
            data: { id: 'config' },
        });
    }

    // Mask sensitive fields before sending to client
    const maskedConfig = {
        ...config,
        awsAccessKeyId: config.awsAccessKeyId ? '********' : '',
        awsSecretAccessKey: config.awsSecretAccessKey ? '********' : '',
        emailServer: config.emailServer ? '********' : '',
        redisUrl: config.redisUrl ? '********' : '',
    };

    return (
        <div className="p-8">
            {/* Breadcrumbs */}
            <Breadcrumbs
                items={[
                    { label: 'Dashboard', href: '/super-admin' },
                    { label: 'Settings' },
                ]}
                className="mb-4"
            />

            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Platform Settings</h1>
                <p className="text-slate-600 mt-2">Manage environment variables and system configuration</p>
            </div>

            {/* Settings Form */}
            <SettingsForm config={maskedConfig} />
        </div>
    );
}
