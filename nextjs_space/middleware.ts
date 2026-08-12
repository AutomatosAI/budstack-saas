import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest, type NextFetchEvent } from "next/server";
import { parseHostToTenantHint } from "@/lib/parse-host";
import { customDomainRewritePath } from "@/lib/custom-domain-rewrite";
import { applyCsp, buildCsp, generateNonce, variantForServedPath } from "@/lib/security/csp";

// Define public routes
const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/login(.*)",
  "/auth/signup(.*)",
  "/store/(.*)", // Storefronts are public
  "/api/webhooks(.*)",
  "/api/uploadthing(.*)",
  "/api/doctor-green(.*)",
  "/api/auth(.*)", // Legacy NextAuth routes
  "/api/store(.*)", // Storefront APIs
  "/api/storefront/newsletter/subscribe", // Public newsletter signup (US-002)
  "/onboarding", // Customer onboarding wizard
  "/api/onboarding", // Public onboarding validation/submission
  "/api/consultation(.*)", // Public consultation submission
  "/marketplace", // Public template marketplace
  "/learn", // Public learning center
  "/learn/(.*)", // Learning center articles
  "/blog", // Public blog
  "/blog/(.*)", // Blog articles
  "/contact", // Contact page
  "/terms", // Terms of service
  "/privacy", // Privacy policy
  "/cookies", // Cookie policy
  "/accept-invite(.*)", // PRD-301 team invitation acceptance (logged-out invitees)
  "/api/team/invitation(.*)", // PRD-301 public token-gated invitation preview
]);

// Define routes that require Tenant Context but might be public (like Storefront)
const isTenantRoute = createRouteMatcher([
  "/store/(.*)",
  "/tenant-admin/(.*)",
]);

// Resolve the real tenant host behind the Cloudflare-for-SaaS proxy. The CF
// Worker rewrites Host → the Railway origin (Railway routes by Host and would
// otherwise 404) and carries the real hostname in X-Original-Host, secret-gated
// so a client hitting the Railway origin directly cannot spoof another tenant's
// domain. Falls back to the Host header for platform traffic + local dev.
function resolveTenantHost(req: NextRequest): string {
  const cfProxySecret = process.env.CF_PROXY_SECRET;
  const originalHost = req.headers.get('x-original-host');
  const proxySecret = req.headers.get('x-cf-proxy-secret');
  return cfProxySecret && originalHost && proxySecret === cfProxySecret
    ? originalHost
    : req.headers.get('host') || '';
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  // 1. Tenant Routing Logic (must run BEFORE auth check)
  // Subdomain rewrites change /products → /store/slug/products which matches
  // the public route pattern. If auth runs first, bare paths like /products
  // would incorrectly require login on subdomain sites.
  const url = req.nextUrl;
  // Real tenant host behind the CF-for-SaaS proxy (see resolveTenantHost). The
  // outer middleware() wrapper has already re-published this as x-forwarded-host
  // so Clerk builds its redirects against the tenant domain, not the Railway origin.
  const hostname = resolveTenantHost(req);
  const pathname = url.pathname;
  const requestHeaders = new Headers(req.headers);

  // Clean headers
  requestHeaders.delete('x-tenant-slug');
  requestHeaders.delete('x-tenant-subdomain');
  requestHeaders.delete('x-tenant-custom-domain');
  // Never let the CF proxy secret propagate past middleware (logs / app / SSR).
  requestHeaders.delete('x-cf-proxy-secret');

  // SECURITY (PRD-218, AC-2): one fresh nonce per request. Exposed to Server
  // Components / <ClerkProvider dynamic> via the x-nonce request header and
  // bound into the response CSP below — request and response nonce must match.
  const nonce = generateNonce();
  requestHeaders.set('x-nonce', nonce);
  // Next's app-render + next/script read the nonce from the *request* CSP
  // header (not x-nonce) to nonce the framework bootstrap + <Script> tags —
  // without this they are blocked under 'strict-dynamic' and the page never
  // hydrates. The variant is irrelevant on the request copy (only the
  // 'nonce-…' token is parsed and the browser never sees this header); each
  // response still gets its precise per-variant policy via applyCsp below.
  requestHeaders.set('Content-Security-Policy', buildCsp({ nonce, variant: 'base' }));

  // PRD-205 (AC-2a): the host→tenant-hint classification is shared with the canonical
  // resolver via parseHostToTenantHint, so middleware and lib/tenant-resolver.ts cannot
  // drift. The path REWRITES + the API/platform/clerk-proxy carve-outs (and the dev-only
  // .abacusai.app skip below) stay here — they are middleware-specific, not host→tenant
  // mapping. parseHostToTenantHint reads NEXT_PUBLIC_BASE_DOMAIN itself and strips the port.
  const hint = parseHostToTenantHint(hostname);

  // PRIORITY 1: Subdomain-based routing (REWRITE)
  // Rewrite slug.budstacks.io/foo -> /store/slug/foo
  // Returns early — all storefront pages are public
  if (hint?.kind === 'subdomain') {
    const subdomain = hint.subdomain;
    requestHeaders.set('x-tenant-subdomain', subdomain);

    // API routes: don't rewrite path — APIs already include slug in their URL.
    // But still run auth check below (don't return early).
    if (pathname.startsWith('/api/')) {
      if (!isPublicRoute(req)) {
        const { userId, redirectToSignIn } = await auth();
        if (!userId) {
          return applyCsp(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), nonce, "base");
        }
      }
      return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce, "base");
    }

    // Admin surfaces are apex-only. On a tenant host, redirect to the canonical
    // apex (preserving path + query) instead of serving the host-agnostic admin
    // app — it renders on every subdomain (confusing) and needlessly widens the
    // surface. Tenant isolation is enforced by the session's tenantId, never the
    // host (see withTenantAuth / tenant-admin layout), so this is hardening + UX.
    if (pathname.startsWith('/tenant-admin') || pathname.startsWith('/super-admin')) {
      const apex = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'budstacks.io';
      const dest = new URL(url);
      dest.host = apex;
      dest.protocol = 'https:';
      dest.port = '';
      return applyCsp(NextResponse.redirect(dest, 307), nonce, 'base');
    }

    // Other platform routes (/auth, /onboarding) stay on the tenant host:
    // shopper login + public signup happen on the storefront, not the apex.
    if (pathname.startsWith('/auth/') || pathname.startsWith('/onboarding')) {
      return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce, variantForServedPath(pathname));
    }

    // Page routes: rewrite to internal store route
    url.pathname = `/store/${subdomain}${pathname}`;
    return applyCsp(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), nonce, "store");
  }

  // PRIORITY 2: Custom domain routing (REWRITE)
  // Rewrite example.com/products -> /store/cd-<hash(host)>/products so Next.js
  // file routing matches app/store/[slug]/. PRD-212: the segment is HOST-SCOPED
  // (was the constant /store/_cd) so the ISR full-route cache — keyed on the
  // resolved pathname, not on headers — gets a DISTINCT key per custom domain
  // and can never serve one tenant's cached HTML on another tenant's domain.
  // The segment is a cache-key dimension only; it is never used for DB lookups —
  // getCurrentTenant() still resolves via the x-tenant-custom-domain header.
  if (
    hint?.kind === 'customDomain' &&
    !(process.env.NODE_ENV === 'development' && hint.host.includes('.abacusai.app'))
  ) {
    requestHeaders.set('x-tenant-custom-domain', hint.host);

    // API routes: don't rewrite path, just forward the header
    if (pathname.startsWith('/api/')) {
      if (!isPublicRoute(req)) {
        const { userId } = await auth();
        if (!userId) {
          return applyCsp(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), nonce, "base");
        }
      }
      return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce, "base");
    }

    // Clerk proxy: /__clerk/* must reach next.config.js rewrite, not get rewritten to /store/cd-…/
    if (pathname.startsWith('/__clerk')) {
      return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce, "base");
    }

    // Admin surfaces are apex-only — redirect off the custom domain to the
    // canonical apex (preserving path + query). Isolation is session-scoped, not
    // host-scoped, so this is hardening + UX, not a data-leak fix.
    if (pathname.startsWith('/tenant-admin') || pathname.startsWith('/super-admin')) {
      const apex = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'budstacks.io';
      const dest = new URL(url);
      dest.host = apex;
      dest.protocol = 'https:';
      dest.port = '';
      return applyCsp(NextResponse.redirect(dest, 307), nonce, 'base');
    }

    // Other platform routes (/auth, /onboarding) stay on the custom domain.
    if (pathname.startsWith('/auth/') || pathname.startsWith('/onboarding')) {
      return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce, variantForServedPath(pathname));
    }

    // Page routes: rewrite to internal store route with a HOST-SCOPED segment
    // (PRD-212). hint.host is the real custom domain; the derived cd-<hash>
    // segment isolates this domain's ISR cache from every other custom domain.
    url.pathname = customDomainRewritePath(hint.host, pathname);
    return applyCsp(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), nonce, "store");
  }

  // 2. Authentication Check (only for non-subdomain, non-custom-domain requests)
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return applyCsp(redirectToSignIn({ returnBackUrl: req.url }), nonce, "base");
    }
  }

  // PRIORITY 3: Path-based routing (localhost / dev)
  const storeMatch = pathname.match(/^\/store\/([^\/]+)(.*)/);
  if (storeMatch) {
    const tenantSlug = storeMatch[1];
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }

  // All requests forward with the nonce + per-request CSP. The static
  // next.config.js CSP was removed (PRD-218) — every response must carry the
  // policy from here so no page renders without it.
  return applyCsp(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
    variantForServedPath(pathname),
  );
});

// Clerk derives every absolute URL it builds — most visibly the dev-browser
// handshake redirect_url, but also sign-in / after-auth / satellite-sync
// redirects — from `x-forwarded-host ?? host` (see @clerk/backend
// ClerkRequest.deriveUrlFromHeaders). Behind the CF-for-SaaS proxy the Host
// header is the Railway origin (budstack-saas-development.up.railway.app), so
// without this Clerk sends users to the Railway URL instead of back to their
// tenant domain. Re-derive the real tenant host and publish it as
// x-forwarded-host BEFORE clerkMiddleware runs, so Clerk (and any SSR
// absolute-URL construction downstream) uses the tenant domain. Platform
// traffic (budstacks.io) and local dev are unaffected — realHost === Host there.
export default function middleware(req: NextRequest, evt: NextFetchEvent) {
  const realHost = resolveTenantHost(req);
  if (realHost && req.headers.get('x-forwarded-host') !== realHost) {
    const headers = new Headers(req.headers);
    headers.set('x-forwarded-host', realHost);
    if (!headers.get('x-forwarded-proto')) headers.set('x-forwarded-proto', 'https');
    return clerkHandler(new NextRequest(req, { headers }), evt);
  }
  return clerkHandler(req, evt);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
