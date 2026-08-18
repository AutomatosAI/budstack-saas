import { describe, it, expect } from "vitest";

// Email Phase 2 US-005 — the durable public image URL.
//
// This endpoint is unauthenticated by design, so the parser IS the access
// control: whatever it returns gets streamed out of a private bucket to an
// anonymous caller. Three properties carry that weight and are asserted here
// rather than left to review:
//   1. only `tenants/{id}/uploads/` keys resolve — nothing else in the bucket;
//   2. traversal and encoding tricks resolve to nothing at all;
//   3. the Content-Type we serve comes from a closed allow-list that has no
//      SVG in it, so a served object can never be script.
import {
  PUBLIC_IMAGE_ROUTE_PREFIX,
  isServablePublicImageType,
  parsePublicImageRequest,
  publicImageContentType,
  publicImagePath,
  storedPublicImagePath,
} from "@/lib/storage/public-image-url";

const PREFIX = "development/";
const KEY = "development/tenants/tenant-a/uploads/1754000000000-cover.png";

describe("publicImagePath", () => {
  it("is origin-relative so it resolves on whatever host renders it", () => {
    // A storefront runs under img-src 'self' on its own subdomain / custom
    // domain — an absolute apex URL would be CSP-blocked on the pages that
    // need it most.
    const path = publicImagePath(KEY);
    expect(path.startsWith(PUBLIC_IMAGE_ROUTE_PREFIX)).toBe(true);
    expect(path).not.toMatch(/^https?:/);
  });

  it("keeps path separators but encodes everything else in a segment", () => {
    expect(publicImagePath(KEY)).toBe(`${PUBLIC_IMAGE_ROUTE_PREFIX}${KEY}`);
    expect(publicImagePath("dev/tenants/a/uploads/1-my file.png")).toBe(
      `${PUBLIC_IMAGE_ROUTE_PREFIX}dev/tenants/a/uploads/1-my%20file.png`,
    );
  });

  it("round-trips a filename containing % / # / ? through the parser", () => {
    const awkward = `${PREFIX}tenants/tenant-a/uploads/1-100%#?.png`;
    const encodedPath = publicImagePath(awkward).slice(
      PUBLIC_IMAGE_ROUTE_PREFIX.length,
    );

    expect(parsePublicImageRequest(encodedPath, PREFIX)?.s3Key).toBe(awkward);
  });
});

describe("publicImageContentType — the allow-list", () => {
  it("maps the image extensions we serve", () => {
    expect(publicImageContentType("a/b/x.PNG")).toBe("image/png");
    expect(publicImageContentType("a/b/x.jpg")).toBe("image/jpeg");
    expect(publicImageContentType("a/b/x.jpeg")).toBe("image/jpeg");
    expect(publicImageContentType("a/b/x.gif")).toBe("image/gif");
    expect(publicImageContentType("a/b/x.webp")).toBe("image/webp");
  });

  it("refuses SVG — it is XML and can carry script", () => {
    expect(publicImageContentType("a/b/x.svg")).toBeNull();
  });

  it("refuses everything that is not an allow-listed image", () => {
    for (const key of [
      "a/b/x.html",
      "a/b/x.pdf",
      "a/b/x.mp4",
      "a/b/x.json",
      "a/b/noextension",
    ]) {
      expect(publicImageContentType(key)).toBeNull();
    }
  });
});

describe("isServablePublicImageType", () => {
  it("accepts an allow-listed type, with or without parameters", () => {
    expect(isServablePublicImageType("image/png")).toBe(true);
    expect(isServablePublicImageType("IMAGE/PNG; charset=binary")).toBe(true);
  });

  it("rejects anything else a mislabelled object could claim", () => {
    expect(isServablePublicImageType("text/html")).toBe(false);
    expect(isServablePublicImageType("image/svg+xml")).toBe(false);
    expect(isServablePublicImageType("application/pdf")).toBe(false);
  });
});

// SEO US-001 — the resolver that decides what may appear in rendered metadata
// (<link rel="icon">, og:image). It fails CLOSED: a URL that expires, or a key
// the route above would 404, resolves to nothing so the caller can fall back to
// a platform default instead of shipping a tag that breaks silently.
describe("storedPublicImagePath", () => {
  it("routes a stored upload key through the durable public route", () => {
    expect(storedPublicImagePath(KEY)).toBe(
      `${PUBLIC_IMAGE_ROUTE_PREFIX}${KEY}`,
    );
    expect(storedPublicImagePath(`  ${KEY}  `)).toBe(
      `${PUBLIC_IMAGE_ROUTE_PREFIX}${KEY}`,
    );
  });

  it("routes a stored platform upload key the same way", () => {
    // Whatever resolves through the route must resolve here too, or metadata
    // would fail closed on an image the blog renders perfectly well.
    const platformKey = `${PREFIX}platform/uploads/1754000000000-cover.png`;
    expect(storedPublicImagePath(platformKey)).toBe(
      `${PUBLIC_IMAGE_ROUTE_PREFIX}${platformKey}`,
    );
  });

  it("passes through a path that is already on this origin", () => {
    expect(storedPublicImagePath("/favicon.svg")).toBe("/favicon.svg");
    expect(storedPublicImagePath(`${PUBLIC_IMAGE_ROUTE_PREFIX}${KEY}`)).toBe(
      `${PUBLIC_IMAGE_ROUTE_PREFIX}${KEY}`,
    );
  });

  it("keeps a durable absolute URL but drops a presigned one", () => {
    expect(storedPublicImagePath("https://cdn.example/logo.png")).toBe(
      "https://cdn.example/logo.png",
    );
    expect(
      storedPublicImagePath(
        `https://bucket.s3.eu-west-1.amazonaws.com/${KEY}?X-Amz-Expires=3600&X-Amz-Signature=abc`,
      ),
    ).toBeNull();
  });

  it("drops anything with no route: wrong prefix, wrong extension, no value", () => {
    for (const stored of [
      null,
      undefined,
      "",
      "   ",
      "//cdn.example/logo.png", // protocol-relative — no scheme to resolve against
      "development/tenants/tenant-a/templates/x/favicon.png", // not an upload
      "development/uploads/1-cover.png", // no tenant segment
      "development/platform/logo-1-brand.png", // platform branding, not an upload
      `${PREFIX}tenants/tenant-a/uploads/1-icon.svg`, // never served
    ]) {
      expect(storedPublicImagePath(stored)).toBeNull();
    }
  });
});

describe("parsePublicImageRequest — what is servable", () => {
  it("resolves a tenant upload, keeping the bucket prefix for the S3 read", () => {
    const parsed = parsePublicImageRequest(KEY, PREFIX);

    expect(parsed).toEqual({
      s3Key: KEY,
      relativeKey: "tenants/tenant-a/uploads/1754000000000-cover.png",
      tenantId: "tenant-a",
      contentType: "image/png",
    });
  });

  it("works when the bucket has no folder prefix at all", () => {
    const key = "tenants/tenant-a/uploads/1-cover.webp";
    const parsed = parsePublicImageRequest(key, "");

    expect(parsed?.s3Key).toBe(key);
    expect(parsed?.relativeKey).toBe(key);
    expect(parsed?.contentType).toBe("image/webp");
  });

  // Platform US-005 — budstacks.io's own blog covers. It is not a tenant, so
  // its uploads carry no tenant id; everything else about them is unchanged.
  it("resolves a platform upload, with no tenant on it", () => {
    const parsed = parsePublicImageRequest(
      `${PREFIX}platform/uploads/1754000000000-cover.jpg`,
      PREFIX,
    );

    expect(parsed).toEqual({
      s3Key: `${PREFIX}platform/uploads/1754000000000-cover.jpg`,
      relativeKey: "platform/uploads/1754000000000-cover.jpg",
      tenantId: null,
      contentType: "image/jpeg",
    });
  });

  it("decodes percent-escapes exactly once", () => {
    const parsed = parsePublicImageRequest(
      `${PREFIX}tenants/tenant-a/uploads/1-my%20cover.png`,
      PREFIX,
    );

    expect(parsed?.s3Key).toBe(`${PREFIX}tenants/tenant-a/uploads/1-my cover.png`);
  });
});

describe("parsePublicImageRequest — what is NOT servable", () => {
  const rejected: ReadonlyArray<readonly [string, string]> = [
    ["plain traversal", `${PREFIX}tenants/tenant-a/uploads/../../secrets.png`],
    ["encoded traversal", `${PREFIX}tenants/tenant-a/uploads/..%2Fsecrets.png`],
    ["traversal in the tenant segment", `${PREFIX}tenants/../tenants/b/uploads/x.png`],
    ["backslash separator", `${PREFIX}tenants\\tenant-a\\uploads\\x.png`],
    ["malformed percent escape", `${PREFIX}tenants/tenant-a/uploads/%E0%A4%A.png`],
    ["a sibling prefix, not uploads", `${PREFIX}tenants/tenant-a/templates/logo.png`],
    ["a prefix that merely starts with uploads", `${PREFIX}tenants/tenant-a/uploadsX/x.png`],
    ["outside tenants/ entirely", `${PREFIX}templates/healingbudsv2/logo.png`],
    ["the tenant root itself", `${PREFIX}tenants/tenant-a/uploads/`],
    ["an empty tenant segment", `${PREFIX}tenants//uploads/x.png`],
    ["an SVG under a valid prefix", `${PREFIX}tenants/tenant-a/uploads/1-logo.svg`],
    // The platform prefix opens `platform/uploads/` and nothing else under it:
    // the branding keys written by super-admin/platform-settings, and any
    // sibling folder someone adds later, stay private.
    ["a platform key outside uploads/", `${PREFIX}platform/logo-1754000000000-brand.png`],
    ["a platform sibling of uploads/", `${PREFIX}platform/backups/1-cover.png`],
    ["a prefix that merely starts with platform", `${PREFIX}platformX/uploads/1-cover.png`],
    ["an SVG under the platform prefix", `${PREFIX}platform/uploads/1-logo.svg`],
    ["an HTML file under a valid prefix", `${PREFIX}tenants/tenant-a/uploads/1-x.html`],
    ["a PDF under a valid prefix", `${PREFIX}tenants/tenant-a/uploads/1-terms.pdf`],
    ["no extension at all", `${PREFIX}tenants/tenant-a/uploads/1-cover`],
    ["nothing", ""],
  ];

  for (const [label, path] of rejected) {
    it(`rejects ${label}`, () => {
      expect(parsePublicImageRequest(path, PREFIX)).toBeNull();
    });
  }

  it("cannot be walked out of the uploads folder by a doubled slash", () => {
    // `//` collapses rather than resetting to the bucket root, so this still
    // has to land inside tenants/{id}/uploads/ to resolve.
    expect(
      parsePublicImageRequest(`${PREFIX}tenants/tenant-a/uploads//x.png`, PREFIX)?.s3Key,
    ).toBe(`${PREFIX}tenants/tenant-a/uploads/x.png`);
    expect(
      parsePublicImageRequest(`${PREFIX}//tenants/tenant-a/backup/x.png`, PREFIX),
    ).toBeNull();
  });
});
