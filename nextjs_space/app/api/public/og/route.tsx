import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";

import { apiError } from "@/lib/api-error";
import {
  OG_IMAGE_MAX_REQUESTS,
  OG_IMAGE_TIMEOUT_MS,
  OG_IMAGE_WINDOW_MS,
} from "@/lib/constants";
import { buildOgCardModel, type OgCardModel } from "@/lib/seo/og-card";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_ROUTE,
  OG_IMAGE_WIDTH,
  parseOgImageRequest,
} from "@/lib/seo/og-image";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import { tenantLogoRef } from "@/lib/seo/tenant-logo";
import { withinPublicRateLimit } from "@/lib/security/abandonable-rate-limit";
import { createS3Client, getBucketConfig } from "@/lib/storage/aws-config";
import {
  PUBLIC_IMAGE_ROUTE_PREFIX,
  parsePublicImageRequest,
  storedPublicImagePath,
} from "@/lib/storage/public-image-url";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant/tenant";

/**
 * SEO Supercharge US-018 — the branded social preview image.
 *
 * THE DEFECT THIS CLOSES: most storefront pages carried no `og:image` at all,
 * because most owners never pasted one. A shared link with no image is the grey
 * row every messenger renders for a URL it could not preview. This route mints
 * a 1200x630 card from the tenant's own logo, brand colour and page title, and
 * `lib/seo/og-image.ts` wires it in as the LAST fallback in every builder's
 * image cascade — after an authored `seo.ogImage`, after a post cover or a
 * product photo, because a real photograph previews better than any card.
 *
 * RUNTIME = NODEJS, not edge, and the reason is not preference. The card is
 * built from the tenant row (`getCurrentTenant` → Prisma) and the logo is read
 * straight out of S3 with the AWS SDK; neither runs under the edge runtime
 * without a Data Proxy this deployment does not have. `next/og` supports both
 * runtimes (next/dist/server/og/image-response.js picks `index.node.js` when
 * NEXT_RUNTIME is not "edge") and ships its own font and WASM as files it reads
 * with `readFileSync`, so there is no network dependency in the render either.
 *
 * PUBLIC BY NECESSITY, and registered as such in BOTH gates — `isPublicRoute`
 * in middleware.ts and AUTH_PUBLIC_ROUTES in lib/auth-public-routes.ts. The
 * callers are Slack, X, Facebook and every other scraper fetching an `og:image`
 * out of band; not one of them has a session. What keeps that safe:
 *   - the TENANT COMES FROM THE HOST, never from the query. Logo, colour, name
 *     and printed domain are all read from the resolved row, so a crafted URL
 *     cannot put one store's branding on another store's card;
 *   - the only caller-controlled pixel is the headline, a Zod-capped string
 *     (`parseOgImageRequest`), rendered as text and nothing else;
 *   - the logo is read from S3 through the same tenant-scope guard that gates
 *     `/api/public/images`, and ONLY when the stored reference resolves to a
 *     key under this platform's own bucket. An owner-supplied absolute URL is
 *     skipped rather than fetched — `tenant_branding.logoUrl` is tenant-
 *     writable, and a renderer that fetched it would be a server-side request
 *     forgery with the tenant holding the steering wheel;
 *   - it is IP rate-limited, because a WASM rasterise is expensive and an
 *     un-metered image generator on a shared container is a DoS amplifier.
 *
 * PLAN GATE. `seo.pro` only: a Basic tenant's pages never reference this route
 * (the builders emit no URL for them), and a direct hit answers 404 — the same
 * answer as a tenant that does not exist, so the endpoint cannot be used to
 * enumerate which stores are on which plan. Nothing on the storefront blocks:
 * a Basic page simply renders the tags it always did.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = `GET ${OG_IMAGE_ROUTE}`;

/**
 * A generated card is not immutable — an owner who changes their logo or brand
 * colour must see it change — so this is deliberately NOT the one-year
 * immutable header `ImageResponse` sets by default. An hour in the browser, a
 * day at the CDN, a week of serving stale while it refreshes: long enough that
 * a crawl storm is absorbed by Cloudflare, short enough that a rebrand is
 * visible the same day.
 *
 * THE KEY MUST BE LOWERCASE. `ImageResponse` builds its header object as
 * `{ "content-type": …, "cache-control": …, ...options.headers }` (next/dist/
 * server/og/image-response.js) — a plain-object spread, so `Cache-Control` and
 * `cache-control` are two DIFFERENT keys and both survive into the `Headers`
 * constructor, which joins them with a comma. The browser then takes the first
 * `max-age` it sees, which is the default's one-year immutable. Verified by
 * rendering: with the capitalised key the response carried
 * `public, immutable, no-transform, max-age=31536000, public, max-age=3600`.
 */
const OG_CACHE_CONTROL_HEADER = "cache-control";
const OG_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/**
 * The image formats the rasteriser behind `next/og` can actually decode, and
 * this allow-list is LOAD-BEARING rather than tidiness.
 *
 * Measured against the bundled build by rendering the same 64x64 square encoded
 * five ways: png, jpeg and gif each produced an identical 845-byte card, while
 * webp and avif THREW ("a is not iterable"). And they throw from inside
 * `ImageResponse`'s ReadableStream, which is consumed AFTER the handler has
 * returned — so the `try` around this route cannot catch it and the caller gets
 * a 200 whose body dies mid-flight. There is no recovery downstream; refusing
 * the format here is the only defence.
 *
 * That combination is reachable: `/api/public/images` serves WebP (it is in
 * `PUBLIC_IMAGE_TYPES_BY_EXTENSION`), so `storedPublicImagePath` hands back a
 * path for a `.webp` logo quite happily. A tenant who uploaded one would have
 * broken every card on their store. They now fall through to the monogram chip.
 *
 * The Content-Type comes from the key's EXTENSION, which is trustworthy because
 * `validateUploadBuffer` magic-byte checks every upload at write time — a `.png`
 * key holds PNG bytes, so nothing needs re-sniffing here.
 */
const RENDERABLE_LOGO_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
]);

/** Counter namespace, so this route never shares a bucket with another. */
const OG_RATE_LIMIT_SCOPE = "og-image";

/** One 404 for every rejection: no tenant, no Pro, nothing to render. */
function notFound(reason: unknown): NextResponse {
  return apiError(reason, {
    route: ROUTE,
    status: 404,
    safeMessage: "Image not found",
  });
}

/**
 * Over the cap. A plain 429 rather than the limiter's own JSON body: the caller
 * is a scraper expecting an image, and the interesting part for it is the
 * status and `Retry-After`, not a message it will never display.
 */
function tooManyRequests(): NextResponse {
  return new NextResponse(null, {
    status: 429,
    headers: { "retry-after": String(Math.ceil(OG_IMAGE_WINDOW_MS / 1000)) },
  });
}

/**
 * The tenant's logo as a `data:` URI, or null when there is none we can render.
 *
 * Read from S3 directly rather than by fetching our own `/api/public/images`
 * URL: that would make the container issue an HTTP request to its own public
 * hostname — out through Cloudflare and back — on every uncached card, and it
 * would need an absolute URL built from a header. The bytes are already
 * reachable with the credentials this process holds.
 *
 * `storedPublicImagePath` is what decides eligibility. It returns a
 * `/api/public/images/…` path ONLY for a key under `tenants/{id}/uploads/` with
 * a served image extension; an absolute URL, a presigned link or a template
 * asset gets rejected here rather than fetched.
 */
async function tenantLogoDataUri(logoRef: string | null): Promise<string | null> {
  const path = storedPublicImagePath(logoRef);
  if (!path?.startsWith(PUBLIC_IMAGE_ROUTE_PREFIX)) return null;

  try {
    const { bucketName, folderPrefix } = await getBucketConfig();
    // The path is still percent-ENCODED, which is what the parser expects: it
    // decodes exactly once, and that single decode is what catches `..%2F`.
    const parsed = parsePublicImageRequest(
      path.slice(PUBLIC_IMAGE_ROUTE_PREFIX.length),
      folderPrefix,
    );
    if (!parsed || !RENDERABLE_LOGO_TYPES.has(parsed.contentType)) return null;

    const s3Client = await createS3Client();
    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: parsed.s3Key }),
    );
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes?.length) return null;

    return `data:${parsed.contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    // A missing object, an expired credential, a bucket misconfiguration — none
    // of them should cost the tenant their preview. The card renders with the
    // monogram instead.
    return null;
  }
}

/**
 * The card itself.
 *
 * Satori (inside `ImageResponse`) implements a SUBSET of CSS: flexbox only, and
 * every element with more than one child must set `display: flex` explicitly.
 * Nothing here relies on anything outside that subset — no grid, no transforms,
 * no web fonts. The typeface is the Noto Sans that `next/og` bundles and loads
 * with `readFileSync`, so the render makes no network call.
 */
function ogCard(model: OgCardModel, logo: string | null) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: model.background,
        color: model.foreground,
        padding: "72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {model.label ? (
          <div
            style={{
              fontSize: 26,
              letterSpacing: 6,
              opacity: 0.75,
              marginBottom: 20,
            }}
          >
            {model.label}
          </div>
        ) : null}
        {/*
          `wordBreak` is load-bearing, not decoration. Satori will not split a
          run with no break opportunity in it, so a 90-character product name
          with no spaces — a strain SKU, a German compound — ran straight off
          the right edge of the canvas and out of the image. Verified by
          rendering the cap-length worst case before and after.
        */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            wordBreak: "break-word",
          }}
        >
          {model.headline}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        {logo ? (
          <img
            src={logo}
            // Satori ignores it, and the output is a flat PNG with no text
            // layer for a reader to reach — the accessible description of this
            // image is the `alt` on the og:image tag, not here.
            alt=""
            width={96}
            height={96}
            style={{
              width: 96,
              height: 96,
              objectFit: "contain",
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 12,
            }}
          />
        ) : (
          <div
            style={{
              width: 96,
              height: 96,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: model.foreground,
              color: model.background,
              borderRadius: 20,
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            {model.initials}
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 28,
          }}
        >
          {model.footerName ? (
            <div style={{ fontSize: 34, fontWeight: 600 }}>
              {model.footerName}
            </div>
          ) : null}
          <div style={{ fontSize: 26, opacity: 0.75 }}>{model.host}</div>
        </div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Metered on the client IP, the only identity an anonymous scraper has,
    // and ABANDONABLE: the shared limiter hangs rather than rejects when Redis
    // is unreachable (see lib/security/abandonable-rate-limit.ts — this route
    // is where that was measured at 140s). A Redis outage must cost the cap,
    // never the preview.
    if (
      !(await withinPublicRateLimit({
        scope: OG_RATE_LIMIT_SCOPE,
        headers: request.headers,
        maxRequests: OG_IMAGE_MAX_REQUESTS,
        windowMs: OG_IMAGE_WINDOW_MS,
        timeoutMs: OG_IMAGE_TIMEOUT_MS,
      }))
    ) {
      return tooManyRequests();
    }

    // From the HOST, via the headers middleware set — never from the query.
    const tenant = await getCurrentTenant();
    if (!tenant) return notFound(new Error("Host resolves to no tenant"));

    if (!isSeoProUnlocked({ id: tenant.id, plan: tenant.plan })) {
      return notFound(new Error("Tenant plan does not include seo.pro"));
    }

    const { kind, title } = parseOgImageRequest(request.nextUrl.searchParams);

    // The same React-cache()d query the store layout already makes, so a card
    // rendered during a page request costs no extra round trip; a scraper
    // fetching the image on its own pays for exactly one.
    const branding = await getTenantWithTemplate(tenant.id);

    const model = buildOgCardModel({
      businessName: tenant.businessName,
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain,
      brandColor: branding?.tenant_branding?.primaryColor,
      kind,
      title,
    });

    const logo = await tenantLogoDataUri(
      branding ? tenantLogoRef(branding) : null,
    );

    return new ImageResponse(ogCard(model, logo), {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      headers: { [OG_CACHE_CONTROL_HEADER]: OG_CACHE_CONTROL },
    });
  } catch (error) {
    return apiError(error, {
      route: ROUTE,
      safeMessage: "Image unavailable",
    });
  }
}
