import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";
import { Search } from "lucide-react";
import { SeoPageClient } from "./seo-page-client";

export default async function SeoPage() {
  // PRD-302: impersonation-aware tenant (matches the banner).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  const tenantId = active.tenantId;

  const [tenant, products, posts] = await Promise.all([
    prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subdomain: true,
        customDomain: true,
        businessName: true,
        pageSeo: true,
      },
    }),
    prisma.products.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        // SEO US-004: the storefront product route is keyed by the Dr Green
        // strain id, so this — not `slug` — is what the preview URL is built
        // from. The old `/products/{slug}` preview was a 404 for every product.
        drGreenStrainId: true,
        seo: true,
        images: true,
      },
    }),
    prisma.posts.findMany({
      where: { tenantId },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        seo: true,
        coverImage: true,
      },
    }),
  ]);

  if (!tenant) {
    redirect("/tenant-admin");
  }

  const baseUrl = getTenantBaseUrl(tenant);

  return (
    <div>
      <div className="bs-page-header-centered">
        <h1 className="bs-page-title">SEO Manager</h1>
        <p className="bs-page-subtitle">
          Optimize how your store appears in search engines and social media.
        </p>
      </div>

      <SeoPageClient
        tenantId={tenantId}
        baseUrl={baseUrl}
        products={products}
        posts={posts}
        pageSeo={
          tenant.pageSeo as Record<
            string,
            { title?: string; description?: string; ogImage?: string }
          > | null
        }
      />
    </div>
  );
}
