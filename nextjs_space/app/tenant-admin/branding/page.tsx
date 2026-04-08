import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import BrandingForm from './branding-form';
import { Breadcrumbs } from '@/components/admin/shared';
import { Sparkles } from 'lucide-react';

import { getJsonFromS3, getTextFromS3 } from '@/lib/s3';
import { SECTION_ASSET_KEYS } from '@/lib/types/template-layout';

export const dynamic = 'force-dynamic';

export default async function BrandingPage({ searchParams }: { searchParams: { templateId?: string } }) {
  const user = await currentUser();

  if (!user || (user.publicMetadata.role !== 'TENANT_ADMIN' && user.publicMetadata.role !== 'SUPER_ADMIN')) {
    redirect('/auth/login');
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
    // Prefer tenant's own s3Path (includes previous edits), fall back to base template
    const s3Prefix = activeTemplate.s3Path || `templates/${activeTemplate.templates?.slug}`;

    if (s3Prefix) {
      try {
        const layoutJson = await getJsonFromS3(`${s3Prefix}/layout.json`);
        let defaultsJson: any = null;
        try {
          defaultsJson = await getJsonFromS3(`${s3Prefix}/defaults.json`);
        } catch {
          // Defaults might not exist
        }

        // Convert relative asset paths to absolute S3 URLs (top-level + nested arrays)
        if (layoutJson && (layoutJson as any).sections) {
          const { getFileUrl } = await import('@/lib/s3');
          const topKeys = SECTION_ASSET_KEYS;

          const signVal = async (val: string) => {
            if (!val || typeof val !== 'string' || val.startsWith('http') || val.startsWith('/')) return val;
            // Absolute S3 keys (uploaded files) — sign directly
            if (val.startsWith('development/') || val.startsWith('tenants/') || val.startsWith('templates/')) {
              return getFileUrl(val);
            }
            return getFileUrl(`${s3Prefix}/${val}`);
          };

          const signingTasks: Array<{ target: any; key: string; promise: Promise<string> }> = [];

          for (const section of (layoutJson as any).sections) {
            // Top-level config keys
            for (const key of topKeys) {
              const val = section.config?.[key];
              if (val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('/')) {
                signingTasks.push({ target: section.config, key, promise: signVal(val) });
              }
            }
            // Nested arrays — sign any string value that looks like an S3 key
            if (section.config) {
              for (const key of Object.keys(section.config)) {
                if (Array.isArray(section.config[key])) {
                  for (const item of section.config[key]) {
                    if (!item || typeof item !== 'object') continue;
                    for (const itemKey of Object.keys(item)) {
                      const v = item[itemKey];
                      if (v && typeof v === 'string' && !v.startsWith('http') && !v.startsWith('/') && (v.includes('/') || v.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
                        signingTasks.push({ target: item, key: itemKey, promise: signVal(v) });
                      }
                    }
                  }
                }
              }
            }
          }

          const results = await Promise.allSettled(signingTasks.map(t => t.promise));
          results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
              signingTasks[i].target[signingTasks[i].key] = result.value;
            }
          });
        }

        // Attach defaults to layout so BrandingForm can extract heroImage and logo
        if (defaultsJson) {
          const { getFileUrl } = await import('@/lib/s3');
          const signDefaultAsset = async (val: string) => {
            if (!val || val.startsWith('http') || val.startsWith('/')) return val;
            // Absolute S3 keys (uploaded files) — sign directly without prefixing
            if (val.startsWith('development/') || val.startsWith('tenants/') || val.startsWith('templates/')) {
              return getFileUrl(val);
            }
            return getFileUrl(`${s3Prefix}/${val}`);
          };
          if (defaultsJson.heroImagePath) {
            try { defaultsJson.heroImagePath = await signDefaultAsset(defaultsJson.heroImagePath); } catch { }
          }
          if (defaultsJson.logoPath) {
            try { defaultsJson.logoPath = await signDefaultAsset(defaultsJson.logoPath); } catch { }
          }

          (layoutJson as any).defaults = defaultsJson;
        }

        // Fetch template styles.css so the editor preview matches the published site
        let templateCss: string | null = null;
        try {
          templateCss = await getTextFromS3(`${s3Prefix}/styles.css`);
        } catch {
          // styles.css is optional
        }

        // Sign the DB heroImageUrl and logoUrl fields so they're usable in the editor
        if (activeTemplate.heroImageUrl && !activeTemplate.heroImageUrl.startsWith('http') && !activeTemplate.heroImageUrl.startsWith('/')) {
          try {
            const { getFileUrl } = await import('@/lib/s3');
            (activeTemplate as any).signedHeroImageUrl = await getFileUrl(activeTemplate.heroImageUrl);
          } catch { /* leave unsigned */ }
        }
        if (activeTemplate.logoUrl && !activeTemplate.logoUrl.startsWith('http') && !activeTemplate.logoUrl.startsWith('/')) {
          try {
            const { getFileUrl } = await import('@/lib/s3');
            (activeTemplate as any).signedLogoUrl = await getFileUrl(activeTemplate.logoUrl);
          } catch { /* leave unsigned */ }
        }

        (activeTemplate as any).layout = layoutJson;
        (activeTemplate as any).templateCss = templateCss;
      } catch (e) {
        console.error("[BrandingPage] Failed to load layout.json for template", e);
      }
    }
  }

  return (
    <div className="h-full w-full max-w-full overflow-hidden">
      {/* Branding Form (now a full-screen Live Editor) */}
      <BrandingForm tenant={localUser.tenants as any} activeTemplate={activeTemplate} />
    </div>
  );
}
