
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import SettingsForm from './settings-form';
import { Breadcrumbs } from '@/components/admin/shared';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/auth/login');
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: { tenants: true },
  });

  // Mask the secret key before passing to client
  if (user?.tenants?.drGreenSecretKey) {
    // Only indicate it exists, don't send value
    user.tenants.drGreenSecretKey = '********';
  }

  if (!user?.tenants) {
    redirect('/tenant-admin');
  }

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/tenant-admin' },
          { label: 'Settings' },
        ]}
        className="mb-4"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Store Settings</h1>
        <p className="text-slate-600 mt-2">Configure your store preferences</p>
      </div>

      <div className="max-w-4xl">
        <SettingsForm tenant={user.tenants} />
      </div>
    </div>
  );
}
