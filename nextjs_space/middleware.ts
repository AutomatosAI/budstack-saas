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
  "/api/onboarding" // Public onboarding validation/submission
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

  // 2. Tenant Routing Logic (Preserving existing logic)
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;
  const requestHeaders = new Headers(req.headers);

  // Clean headers
  requestHeaders.delete('x-tenant-slug');
  requestHeaders.delete('x-tenant-subdomain');
  requestHeaders.delete('x-tenant-custom-domain');

  const currentHost = hostname.replace(/(:\d+)/, '');

  let tenantFound = false;

  // PRIORITY 1: Path-based routing /store/{tenantSlug}
  const storeMatch = pathname.match(/^\/store\/([^\/]+)/);
  if (storeMatch) {
    const tenantSlug = storeMatch[1];
    requestHeaders.set('x-tenant-slug', tenantSlug);
    tenantFound = true;
  }

  // PRIORITY 2: Subdomain-based routing
  if (!tenantFound && currentHost.endsWith('.budstack.to')) {
    const subdomain = currentHost.replace('.budstack.to', '');
    if (subdomain && subdomain !== 'www') {
      requestHeaders.set('x-tenant-subdomain', subdomain);
      tenantFound = true;
    }
  }

  // PRIORITY 3: Custom domain routing
  if (
    !tenantFound &&
    !currentHost.includes('localhost') &&
    !currentHost.includes('.abacusai.app') &&
    !currentHost.includes('budstack.to') &&
    !currentHost.startsWith('www.')
  ) {
    requestHeaders.set('x-tenant-custom-domain', currentHost);
    tenantFound = true;
  }

  // If we modified headers, we must return a response with them
  // Clerk middleware allows returning a response to override.
  // If we don't return, Clerk continues standard flow.
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
