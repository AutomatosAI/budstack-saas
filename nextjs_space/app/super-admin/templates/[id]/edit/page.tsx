import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import BrandingForm from '@/app/tenant-admin/branding/branding-form';
import { getJsonFromS3, getTextFromS3, getFileUrl } from '@/lib/s3';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SuperAdminTemplateEditPage({ params }: { params: { id: string } }) {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== 'SUPER_ADMIN') {
    redirect('/auth/login');
  }

  const template = await prisma.templates.findUnique({
    where: { id: params.id },
  });

  if (!template) {
    redirect('/super-admin/templates');
  }

  const s3Prefix = `templates/${template.slug}`;

  // Load layout.json from S3
  let layoutJson: any = null;
  try {
    layoutJson = await getJsonFromS3(`${s3Prefix}/layout.json`);
  } catch {
    // Template may not have layout.json yet
  }

  // Load defaults.json from S3
  let defaultsJson: any = null;
  try {
    defaultsJson = await getJsonFromS3(`${s3Prefix}/defaults.json`);
  } catch {
    // defaults.json is optional
  }

  // Sign asset URLs in layout sections (top-level + nested arrays)
  if (layoutJson?.sections) {
    const signVal = async (val: string) => {
      if (!val || typeof val !== 'string' || val.startsWith('http') || val.startsWith('/')) return val;
      if (val.startsWith('development/') || val.startsWith('tenants/') || val.startsWith('templates/')) {
        return getFileUrl(val);
      }
      return getFileUrl(`${s3Prefix}/${val}`);
    };
    const topKeys = ['imageUrl', 'videoUrl', 'watermarkUrl', 'rightImageUrl'] as const;
    const signingTasks: Array<{ target: any; key: string; promise: Promise<string> }> = [];

    for (const section of layoutJson.sections) {
      for (const key of topKeys) {
        const val = section.config?.[key];
        if (val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('/')) {
          signingTasks.push({ target: section.config, key, promise: signVal(val) });
        }
      }
      if (section.config) {
        for (const arrKey of Object.keys(section.config)) {
          if (Array.isArray(section.config[arrKey])) {
            for (const item of section.config[arrKey]) {
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

  // Sign asset URLs in defaults
  if (defaultsJson) {
    if (defaultsJson.heroImagePath && !defaultsJson.heroImagePath.startsWith('http') && !defaultsJson.heroImagePath.startsWith('/')) {
      try { defaultsJson.heroImagePath = await getFileUrl(`${s3Prefix}/${defaultsJson.heroImagePath}`); } catch {}
    }
    if (defaultsJson.logoPath && !defaultsJson.logoPath.startsWith('http') && !defaultsJson.logoPath.startsWith('/')) {
      try { defaultsJson.logoPath = await getFileUrl(`${s3Prefix}/${defaultsJson.logoPath}`); } catch {}
    }
    if (layoutJson) {
      layoutJson.defaults = defaultsJson;
    }
  }

  // Load template CSS
  let templateCss: string | null = null;
  try {
    templateCss = await getTextFromS3(`${s3Prefix}/styles.css`);
  } catch {}

  // Build design system from defaults.json
  const designSystem = defaultsJson?.designSystem || {};

  // Construct a tenant-like object for BrandingForm
  const fakeTenant = {
    id: 'marketplace',
    businessName: template.name,
    subdomain: template.slug || 'preview',
    customDomain: null,
    settings: defaultsJson || {},
  };

  // Construct an activeTemplate-like object
  const fakeActiveTemplate = {
    id: template.id,
    tenantId: 'marketplace',
    baseTemplateId: template.id,
    templateName: template.name,
    s3Path: s3Prefix,
    designSystem,
    pageContent: defaultsJson?.pageContent || {},
    navigation: null,
    footer: null,
    logoUrl: null,
    heroImageUrl: null,
    faviconUrl: null,
    customCss: null,
    customJs: null,
    previewUrl: null,
    isActive: true,
    isDraft: false,
    expiresAt: null,
    source: 'system',
    githubUrl: null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    // Extra fields that BrandingForm expects
    layout: layoutJson,
    templateCss,
    templates: { slug: template.slug },
  };

  return (
    <div className="h-full w-full">
      <div className="px-4 py-2 border-b bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
        <Link href="/super-admin/templates" className="hover:text-amber-900 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Templates
        </Link>
        <span className="text-amber-400">/</span>
        <span className="font-medium">Editing marketplace template: {template.name}</span>
      </div>
      <BrandingForm
        tenant={fakeTenant}
        activeTemplate={fakeActiveTemplate as any}
        apiEndpoint={`/api/super-admin/templates/${template.id}/branding`}
        publishLabel="Save to Marketplace"
      />
    </div>
  );
}
