
import { headers } from 'next/headers';
import { prisma } from './db';
import { cache } from 'react';
import { setTenantContext } from './tenant-context';
import { getJsonFromS3, getTextFromS3 } from './s3';
import type { TemplateLayout } from './types/template-layout';

// Extract Tenant type from Prisma query result
type Tenant = Awaited<ReturnType<typeof prisma.tenants.findFirst>>;

/**
 * Get the current tenant from request headers (set by middleware)
 * This is cached per request to avoid multiple DB queries
 */
export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  const headersList = headers();
  const subdomain = headersList.get("x-tenant-subdomain");
  const customDomain = headersList.get("x-tenant-custom-domain");
  const tenantSlug = headersList.get("x-tenant-slug");

  if (!subdomain && !customDomain && !tenantSlug) {
    setTenantContext(null);
    return null;
  }

  try {
    let tenant: Tenant | null = null;

    if (tenantSlug) {
      // Path-based routing: /store/{slug}
      tenant = await prisma.tenants.findFirst({
        where: {
          subdomain: tenantSlug,
          isActive: true,
        },
      });
    } else if (subdomain) {
      tenant = await prisma.tenants.findFirst({
        where: {
          subdomain: subdomain,
          isActive: true,
        },
      });
    } else if (customDomain) {
      tenant = await prisma.tenants.findFirst({
        where: {
          customDomain: customDomain,
          isActive: true,
        },
      });
    }

    setTenantContext(tenant?.id ?? null);
    return tenant;
  } catch (error) {
    console.error('Error fetching tenant:', error);
    setTenantContext(null);
    return null;
  }
});

/**
 * Fetch tenant with template data (active template + base template).
 * Cached per request — safe to call from both layout.tsx and page.tsx.
 */
export const getTenantWithTemplate = cache(async (tenantId: string) => {
  return prisma.tenants.findUnique({
    where: { id: tenantId },
    include: {
      template: true,
      activeTenantTemplate: {
        include: {
          templates: true,
        },
      },
    },
  });
});

/**
 * Load template assets (layout.json, defaults.json, styles.css) from S3.
 * Tries tenant-specific S3 path first, falls back to base template path.
 * Cached per request — safe to call from both layout.tsx and page.tsx.
 */
export const getTemplateAssets = cache(async (
  tenantS3Path: string | null,
  baseS3Path: string | null,
): Promise<{ layout: TemplateLayout | null; defaults: any; customCss: string | null }> => {
  for (const s3Prefix of [tenantS3Path, baseS3Path].filter(Boolean)) {
    try {
      const layout = await getJsonFromS3<TemplateLayout>(`${s3Prefix}/layout.json`);
      if (layout) {
        let [customCss, defaults] = await Promise.all([
          getTextFromS3(`${s3Prefix}/styles.css`).catch(() => null),
          getJsonFromS3(`${s3Prefix}/defaults.json`).catch(() => null),
        ]);

        // If defaults.json or styles.css weren't found at the tenant path,
        // fall back to the base template path (these files aren't copied on clone)
        if (baseS3Path && s3Prefix !== baseS3Path && (!defaults || !customCss)) {
          const [fallbackCss, fallbackDefaults] = await Promise.all([
            !customCss ? getTextFromS3(`${baseS3Path}/styles.css`).catch(() => null) : Promise.resolve(customCss),
            !defaults ? getJsonFromS3(`${baseS3Path}/defaults.json`).catch(() => null) : Promise.resolve(defaults),
          ]);
          customCss = customCss || fallbackCss;
          defaults = defaults || fallbackDefaults;
        }

        return { layout, defaults, customCss };
      }
    } catch {
      // No layout.json at this prefix — try next
    }
  }
  return { layout: null, defaults: null, customCss: null };
});

/**
 * Get tenant ID from request headers
 * Useful for API routes
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const tenant = await getCurrentTenant();
  return tenant?.id || null;
}

/**
 * Require a tenant or throw an error
 */
export async function requireTenant(): Promise<Tenant> {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    throw new Error("Tenant not found or inactive");
  }

  return tenant;
}

/**
 * Get tenant by slug (subdomain)
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  try {
    // Try exact match first
    let tenant = await prisma.tenants.findFirst({
      where: {
        subdomain: slug,
        isActive: true,
      },
    });

    // If not found, try finding by matching lowercased subdomain
    if (!tenant) {
      // Fetch all active tenants and filter in memory (efficient enough for small number of tenants)
      // or try to find by normalized slug if we suspect casing mismatch
      // For now, let's just log and fail if exact match doesn't work, but we can try to find ignoring case
      // by fetching candidate? No, that's inefficient.

      // Attempt to find by lowercase slug if the original wasn't lowercase
      if (slug !== slug.toLowerCase()) {
        tenant = await prisma.tenants.findFirst({
          where: {
            subdomain: slug.toLowerCase(),
            isActive: true,
          },
        });
      }
    }

    return tenant;
  } catch (error) {
    console.error("Error fetching tenant by slug:", error);
    return null;
  }
}

/**
 * Get tenant from Next.js request (for API routes)
 */
export async function getTenantFromRequest(
  req: Request,
): Promise<Tenant | null> {
  // Try to get tenant from headers (set by middleware)
  const url = new URL(req.url);
  const host = req.headers.get('host') || url.host;
  const pathname = url.pathname;

  try {
    const pathMatch = pathname.match(/^\/store\/([^\/]+)/);
    if (pathMatch) {
      const tenantSlug = pathMatch[1];
      const tenant = await prisma.tenants.findFirst({
        where: {
          subdomain: tenantSlug,
          isActive: true,
        },
      });

      if (tenant) {
        setTenantContext(tenant.id);
        return tenant;
      }
      setTenantContext(null);
    }

    // Extract subdomain from host
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io";
    const subdomain = host.split(".")[0];

    // Check if it's a subdomain request
    if (
      host.includes(baseDomain) &&
      subdomain &&
      subdomain !== baseDomain.split(".")[0]
    ) {
      const tenant = await prisma.tenants.findFirst({
        where: {
          subdomain: subdomain,
          isActive: true,
        },
      });

      if (tenant) {
        setTenantContext(tenant.id);
        return tenant;
      }
      setTenantContext(null);
    }
  } catch (error) {
    console.error('Error fetching tenant from request:', error);
    setTenantContext(null);
    return null;
  }

  setTenantContext(null);
  return null;
}

