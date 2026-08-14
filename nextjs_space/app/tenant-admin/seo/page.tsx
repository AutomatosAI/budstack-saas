import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { isAiAssistConnected } from "@/lib/seo/ai-assist";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import { readSiteVerification } from "@/lib/seo/site-verification";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";
import { SeoPageClient } from "./seo-page-client";

export default async function SeoPage() {
  // US-010's gate on the PAGE, not only on the APIs it calls. This is a Server
  // Component: it reads the tenant's products, posts, conditions and pageSeo
  // itself and ships them in the payload, so a denied member navigating
  // straight to the URL would receive the whole catalogue before any API said
  // no. The nav hides the item (nav-permissions.ts) and the routes 403 — this
  // is what stops the render.
  await requirePagePermission("canViewSeo");

  // PRD-302: impersonation-aware tenant (matches the banner).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  const tenantId = active.tenantId;

  const [tenant, products, posts, conditions, redirects, aiAssistConnected] = await Promise.all([
    prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subdomain: true,
        customDomain: true,
        businessName: true,
        pageSeo: true,
        // US-026: the verification tokens, the GA4 id and the store's Analytics
        // Cookies switch all live in the settings blob. It is read here and
        // PARSED here — only the four resolved values cross to the client, never
        // the blob itself (it also carries SMTP config and the Dr Green keys).
        settings: true,
        // US-013: the entitlement plan, read off the query this page already
        // runs rather than a second round trip through getTenantPlan(). The
        // column is the source of truth (lib/entitlements/plan.ts) and its
        // value is parsed fail-closed downstream, so an unrecognised string
        // locks the tenant out of Pro instead of granting it.
        plan: true,
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
    // SEO US-005: the tenant's OWN conditions only. A store also renders the
    // master tenant's shared conditions (app/store/[slug]/conditions/page.tsx
    // :24-36), but those belong to another tenant — the write route 404s them,
    // so listing them here would offer an edit that always fails.
    prisma.conditions.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        seo: true,
        image: true,
      },
    }),
    // SEO US-020: loaded for EVERY plan, not only Pro. A tenant who drops to
    // Basic keeps their rules — dormant on the storefront, still listed and
    // still deletable here — so a downgrade never looks like data loss. The tab
    // that renders them is Pro-only; the read is not gated (see the route).
    prisma.seo_redirects.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fromPath: true,
        toPath: true,
        statusCode: true,
        createdAt: true,
      },
    }),
    // SEO US-025: does this tenant have Automatos credentials stored? A boolean
    // and only a boolean crosses to the client — the key itself is read inside
    // `lib/seo/ai-assist.ts` and never leaves the server. Resolving it here is
    // what lets the editor show the connect card immediately rather than after a
    // click that spends a rate-limit token to learn the same thing.
    isAiAssistConnected(tenantId),
  ]);

  if (!tenant) {
    redirect("/tenant-admin");
  }

  const baseUrl = getTenantBaseUrl(tenant);

  // `createdAt` crosses the server/client boundary as a STRING, and the client
  // prop type says so rather than declaring a Date that is not one by the time
  // it arrives — the #229 class of render crash. The annotation is also what
  // keeps the `.map` callback typed: lib/db.ts's `prisma` export is any-widened
  // by the build-time mock Proxy, so an inferred `row` would trip TS7006.
  const redirectRows: Array<{
    id: string;
    fromPath: string;
    toPath: string;
    statusCode: number;
    createdAt: Date;
  }> = redirects;

  // US-013: the plan is resolved HERE, server-side, and shipped as a decided
  // boolean. The client never parses a Clerk claim and never re-derives the
  // matrix. This drives presentation only — the boundary for every Pro write is
  // `requireFeature(FEATURES.SEO_PRO)` on the route.
  const seoProUnlocked = isSeoProUnlocked({
    id: tenantId,
    plan: tenant.plan,
  });

  // US-026 — through the fail-closed settings parser, so a malformed blob shows
  // empty fields rather than taking the whole SEO Manager down.
  const settings = parseTenantSettings(tenant.settings, { tenantId });
  const verification = readSiteVerification(settings);

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
        conditions={conditions}
        redirects={redirectRows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        }))}
        seoProUnlocked={seoProUnlocked}
        aiAssistConnected={aiAssistConnected}
        verification={verification}
        analyticsCookiesEnabled={settings.analyticsEnabled === true}
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
