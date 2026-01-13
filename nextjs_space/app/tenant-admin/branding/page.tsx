import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import BrandingForm from './branding-form';
import { Breadcrumbs } from '@/components/admin/shared';

export default async function BrandingPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/auth/login');
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: {
      tenants: {
        include: {
          template: true,
        },
      },
    },
  });

  if (!user?.tenants) {
    redirect("/dashboard");
  }

  // Fetch all available templates
  const templates = await prisma.templates.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  // Fetch active tenant template
  const activeTemplate = user.tenants.activeTenantTemplateId
    ? await prisma.tenant_templates.findUnique({
        where: { id: user.tenants.activeTenantTemplateId },
      })
    : null;

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/tenant-admin" },
          { label: "Branding" },
        ]}
        className="mb-4"
      />

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Store Branding
        </h1>
        <p className="text-slate-600 mt-2">
          Customize the look and feel of your storefront
        </p>
      </div>

      {/* Branding Form */}
      <BrandingForm tenant={user.tenants} activeTemplate={activeTemplate} />
    </div>
  );
}
