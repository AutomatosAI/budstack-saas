import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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
]);

// Define routes that require Tenant Context but might be public (like Storefront)
const isTenantRoute = createRouteMatcher([
  "/store/(.*)",
  "/tenant-admin/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // 1. Tenant Routing Logic (must run BEFORE auth check)
  // Subdomain rewrites change /products → /store/slug/products which matches
  // the public route pattern. If auth runs first, bare paths like /products
  // would incorrectly require login on subdomain sites.
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;
  const requestHeaders = new Headers(req.headers);

  // Clean headers
  requestHeaders.delete('x-tenant-slug');
  requestHeaders.delete('x-tenant-subdomain');
  requestHeaders.delete('x-tenant-custom-domain');

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

  const currentHost = hostname.replace(/(:\d+)/, '');
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io";
  const isLocalhost = currentHost.includes('localhost') || currentHost.includes('127.0.0.1');

  // PRIORITY 1: Subdomain-based routing (REWRITE)
  // Rewrite slug.budstacks.io/foo -> /store/slug/foo
  // Returns early — all storefront pages are public
  if (
    !isLocalhost &&
    currentHost.endsWith(`.${baseDomain}`) &&
    !currentHost.startsWith('www.')
  ) {
    const subdomain = currentHost.replace(`.${baseDomain}`, '');
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

    // Platform routes: don't rewrite — these live outside /store/
    if (pathname.startsWith('/auth/') || pathname.startsWith('/tenant-admin') || pathname.startsWith('/super-admin') || pathname.startsWith('/onboarding')) {
      return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce, variantForServedPath(pathname));
    }

    // Page routes: rewrite to internal store route
    url.pathname = `/store/${subdomain}${pathname}`;
    return applyCsp(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), nonce, "store");
  }

  // PRIORITY 2: Custom domain routing (REWRITE)
  // Rewrite example.com/products -> /store/_cd/products so Next.js file routing
  // matches app/store/[slug]/. The _cd placeholder slug is never used for DB
  // lookups — getCurrentTenant() resolves via the x-tenant-custom-domain header.
  if (
    !isLocalhost &&
    !(process.env.NODE_ENV === 'development' && currentHost.includes('.abacusai.app')) &&
    !currentHost.endsWith(`.${baseDomain}`) &&
    currentHost !== baseDomain &&
    !currentHost.startsWith('www.')
  ) {
    requestHeaders.set('x-tenant-custom-domain', currentHost);

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

    // Clerk proxy: /__clerk/* must reach next.config.js rewrite, not get rewritten to /store/_cd/
    if (pathname.startsWith('/__clerk')) {
      return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce, "base");
    }

    // Platform routes: don't rewrite
    if (pathname.startsWith('/auth/') || pathname.startsWith('/tenant-admin') || pathname.startsWith('/super-admin') || pathname.startsWith('/onboarding')) {
      return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce, variantForServedPath(pathname));
    }

    // Page routes: rewrite to internal store route with placeholder slug
    url.pathname = `/store/_cd${pathname}`;
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

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
