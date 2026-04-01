import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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

  const currentHost = hostname.replace(/(:\d+)/, '');
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io";
  const isLocalhost = currentHost.includes('localhost') || currentHost.includes('127.0.0.1');

  let tenantFound = false;

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
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Platform routes: don't rewrite — these live outside /store/
    if (pathname.startsWith('/auth/') || pathname.startsWith('/tenant-admin') || pathname.startsWith('/super-admin') || pathname.startsWith('/onboarding')) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Page routes: rewrite to internal store route
    url.pathname = `/store/${subdomain}${pathname}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // PRIORITY 2: Custom domain routing (also public storefront)
  if (
    !isLocalhost &&
    !(process.env.NODE_ENV === 'development' && currentHost.includes('.abacusai.app')) &&
    !currentHost.endsWith(`.${baseDomain}`) &&
    currentHost !== baseDomain &&
    !currentHost.startsWith('www.')
  ) {
    requestHeaders.set('x-tenant-custom-domain', currentHost);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 2. Authentication Check (only for non-subdomain, non-custom-domain requests)
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }
  }

  // PRIORITY 3: Path-based routing (localhost / dev)
  const storeMatch = pathname.match(/^\/store\/([^\/]+)(.*)/);
  if (storeMatch) {
    const tenantSlug = storeMatch[1];
    requestHeaders.set('x-tenant-slug', tenantSlug);
    tenantFound = true;
  }

  // If we modified headers, return response with them
  if (tenantFound) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
