import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import BrandingForm from './branding-form';
import { Breadcrumbs } from '@/components/admin/shared';
import { Sparkles } from 'lucide-react';

export default async function BrandingPage() {
  const user = await currentUser();

  if (!user || (user.publicMetadata.role !== 'TENANT_ADMIN' && user.publicMetadata.role !== 'SUPER_ADMIN')) {
    redirect('/sign-in');
  }

  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    include: {
      tenants: {
        include: {
          template: true,
        },
      },
    },
  });

  if (!localUser?.tenants) {
    redirect("/dashboard");
  }

  // Fetch all available templates
  const templates = await prisma.templates.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  // Fetch active tenant template
  const activeTemplate = localUser.tenants.activeTenantTemplateId
    ? await prisma.tenant_templates.findUnique({
      where: { id: localUser.tenants.activeTenantTemplateId },
    })
    : null;

  return (
    <div className="h-full w-full">
      {/* Branding Form (now a full-screen Live Editor) */}
      <BrandingForm tenant={localUser.tenants as any} activeTemplate={activeTemplate} />
    </div>
  );
}
