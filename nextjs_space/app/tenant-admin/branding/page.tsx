import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import BrandingForm from './branding-form';
import { Breadcrumbs } from '@/components/admin/shared';
import { Sparkles } from 'lucide-react';

import { getJsonFromS3 } from '@/lib/s3';

export default async function BrandingPage({ searchParams }: { searchParams: { templateId?: string } }) {
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

  const templateIdToEdit = searchParams.templateId || localUser.tenants.activeTenantTemplateId;

  // Fetch active tenant template
  let activeTemplate = templateIdToEdit
    ? await prisma.tenant_templates.findUnique({
      where: { id: templateIdToEdit },
      include: { templates: true }
    })
    : null;

  if (activeTemplate) {
    const s3Prefix = activeTemplate.source === "cloned"
      ? `templates/${activeTemplate.templates?.slug}`
      : activeTemplate.s3Path;

    if (s3Prefix) {
      try {
        const layoutJson = await getJsonFromS3(`${s3Prefix}/layout.json`);
        (activeTemplate as any).layout = layoutJson;
      } catch (e) {
        console.error("[BrandingPage] Failed to load layout.json for template", e);
      }
    }
  }

  return (
    <div className="h-full w-full">
      {/* Branding Form (now a full-screen Live Editor) */}
      <BrandingForm tenant={localUser.tenants as any} activeTemplate={activeTemplate} />
    </div>
  );
}
