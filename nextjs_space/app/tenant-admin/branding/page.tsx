import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import BrandingForm from './branding-form';
import { Breadcrumbs } from '@/components/admin/shared';
import { Sparkles } from 'lucide-react';

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
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      {/* Centered Page Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="section-badge mb-4 inline-flex">
          <Sparkles className="h-4 w-4" />
          Branding
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Store Branding
        </h1>
        <p className="mt-3 text-muted-foreground mx-auto">
          Customize the look and feel of your storefront.
        </p>
      </div>

      {/* Branding Form */}
      <BrandingForm tenant={user.tenants} activeTemplate={activeTemplate} />
    </div>
  );
}
