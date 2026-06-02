
import { prisma } from '@/lib/db';
import { cache } from 'react';
import { getJsonFromS3, getTextFromS3 } from '@/lib/storage/s3';
import type { TemplateLayout } from '@/lib/types/template-layout';
import { resolveTenant } from '@/lib/tenant/tenant-resolver';

// Extract Tenant type from Prisma query result
type Tenant = Awaited<ReturnType<typeof prisma.tenants.findFirst>>;

/**
 * Resolve the current tenant from request headers (set by Next.js middleware).
 * Cached per request to avoid multiple DB queries.
 *
 * PRD-205: a thin delegator onto the canonical resolveTenant({ kind: 'headers' }).
 * The header precedence (slug → subdomain → customDomain) and isActive filtering
 * now live in one place (lib/tenant-resolver.ts). Still a PURE resolver (PRD-202
 * AC-2): RETURNS the tenant, never binds context — bind at the request boundary via
 * runWithTenantContextAsync (Server Components) or withTenantContext (API routes).
 */
export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  try {
    const resolved = await resolveTenant({ kind: 'headers' });
    return resolved?.tenant ?? null;
  } catch (error) {
    console.error('Error fetching tenant:', error);
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
 * Reads from a single S3 path — no fallback. Each tenant owns their full copy.
 * Cached per request — safe to call from both layout.tsx and page.tsx.
 */
export const getTemplateAssets = cache(async (
  s3Path: string | null,
): Promise<{ layout: TemplateLayout | null; defaults: any; customCss: string | null }> => {
  if (!s3Path) return { layout: null, defaults: null, customCss: null };

  try {
    const layout = await getJsonFromS3<TemplateLayout>(`${s3Path}/layout.json`);
    if (layout) {
      const [customCss, defaults] = await Promise.all([
        getTextFromS3(`${s3Path}/styles.css`).catch(() => null),
        getJsonFromS3(`${s3Path}/defaults.json`).catch(() => null),
      ]);
      return { layout, defaults, customCss };
    }
  } catch {
    // No layout.json at this path
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
 * Get tenant by slug (subdomain).
 *
 * PRD-205: delegates to resolveTenant({ kind: 'slug' }). The lower-case retry and
 * isActive filtering now live in the canonical resolver's bySubdomain.
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  try {
    const resolved = await resolveTenant({ kind: 'slug', slug });
    return resolved?.tenant ?? null;
  } catch (error) {
    console.error("Error fetching tenant by slug:", error);
    return null;
  }
}

/**
 * Resolve the tenant from a Next.js request (for API routes).
 *
 * PRD-205: delegates to resolveTenant({ kind: 'host' }). The /store/{slug} path
 * win, the subdomain/customDomain derivation (now via the shared parseHostToTenantHint)
 * and isActive filtering all live in the canonical resolver. Still a PURE resolver
 * (PRD-202 AC-2): RETURNS the tenant, never binds — bind at the request boundary with
 * withTenantContext; PRD-203's withTenantAuth composes that wrapper.
 */
export async function getTenantFromRequest(
  req: Request,
): Promise<Tenant | null> {
  const url = new URL(req.url);
  const host = req.headers.get('host') || url.host;

  try {
    const resolved = await resolveTenant({
      kind: 'host',
      host,
      pathname: url.pathname,
    });
    return resolved?.tenant ?? null;
  } catch (error) {
    console.error('Error fetching tenant from request:', error);
    return null;
  }
}

