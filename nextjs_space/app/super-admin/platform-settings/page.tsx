
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import PlatformBrandingForm from './platform-branding-form';
import { Breadcrumbs } from '@/components/admin/shared';

export default async function PlatformSettingsPage() {
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

  // Get or create platform settings
  let settings = await prisma.platform_settings.findUnique({
    where: { id: 'platform' },
  });

  if (!settings) {
    settings = await prisma.platform_settings.create({
      data: { id: 'platform', updatedAt: new Date() },
    });
  }

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/super-admin' },
          { label: 'Platform Branding' },
        ]}
        className="mb-4"
      />

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Platform Branding</h1>
        <p className="text-slate-600 mt-2">Customize the look and feel of the main BudStack platform</p>
      </div>

      {/* Branding Form */}
      <PlatformBrandingForm settings={settings} />
    </div>
  );
}
