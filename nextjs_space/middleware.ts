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
  "/api/fix-ds(.*)" // TEMP: fix corrupted designSystem (remove after use)
]);

// Define routes that require Tenant Context but might be public (like Storefront)
const isTenantRoute = createRouteMatcher([
  "/store/(.*)",
  "/tenant-admin/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // 1. Authentication Check
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }
  }

  // 2. Tenant Routing Logic
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
  const isPreview = pathname.startsWith('/store/preview');

  let tenantFound = false;

  // PRIORITY 1: Subdomain-based routing (REWRITE)
  // Rewrite slug.budstacks.io/foo -> /store/slug/foo
  if (
    !isLocalhost &&
    currentHost.endsWith(`.${baseDomain}`) &&
    !currentHost.startsWith('www.')
  ) {
    const subdomain = currentHost.replace(`.${baseDomain}`, '');
    requestHeaders.set('x-tenant-subdomain', subdomain);
    tenantFound = true;

    // Rewrite path to internal store route
    url.pathname = `/store/${subdomain}${pathname}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // PRIORITY 2: Path-based routing (REDIRECT to Subdomain if on root)
  // Redirect budstacks.io/store/slug/foo -> slug.budstacks.io/foo
  const storeMatch = pathname.match(/^\/store\/([^\/]+)(.*)/);
  if (storeMatch) {
    const tenantSlug = storeMatch[1];
    const restPath = storeMatch[2] || '';

    // Otherwise (localhost or internal rewrite processed?), allow path-based access
    requestHeaders.set('x-tenant-slug', tenantSlug);
    tenantFound = true;
  }

  // PRIORITY 3: Custom domain routing
  if (
    !tenantFound &&
    !isLocalhost &&
    !currentHost.includes('.abacusai.app') &&
    !currentHost.endsWith(`.${baseDomain}`) &&
    currentHost !== baseDomain &&
    !currentHost.startsWith('www.')
  ) {
    requestHeaders.set('x-tenant-custom-domain', currentHost);
    tenantFound = true;
  }

  // If we modified headers (and didn't rewrite/redirect), return response with them
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
