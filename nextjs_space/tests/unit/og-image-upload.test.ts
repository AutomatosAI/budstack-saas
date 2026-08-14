import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OG_IMAGE_ACCEPT,
  OG_IMAGE_MAX_BYTES,
  OG_IMAGE_MIN_HEIGHT,
  OG_IMAGE_MIN_WIDTH,
  OG_IMAGE_TYPES,
  OG_IMAGE_UPLOAD_URL,
  ogImageFileError,
  ogImageSizeWarning,
  uploadOgImage,
  type OgImageFile,
} from "@/components/admin/seo/og-image-upload";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/seo/og-image";
import { buildStorePageMetadata } from "@/lib/seo/page-metadata";
import { buildStoreMetadata } from "@/lib/seo/store-metadata";
import {
  isServablePublicImageType,
  storedPublicImagePath,
} from "@/lib/storage/public-image-url";
import { validateUpload } from "@/lib/storage/upload-validation";

// SEO Supercharge US-019 — uploading a social image in the SEO editor.
//
// Three claims decide whether the card a shopper sees is the one the owner
// chose, and each is asserted against the real thing rather than against this
// story's own source:
//
//   1. THE URL THAT GETS STORED. `/api/tenant-admin/upload` answers with two
//      addresses for one object and one of them dies in an hour. The presigned
//      `url` is refused even when the durable one is missing — and the reason
//      is proved here by running a presigned URL through the metadata builder
//      that would have rendered it: it emits no og:image at all.
//   2. THE TYPES ON OFFER. The client list is restated, not imported (bundle
//      safety), so it is walked through BOTH server modules that would refuse a
//      type — the upload route's rules and Email US-005's servable set.
//   3. THE TAG THAT COMES OUT IS ABSOLUTE. What is stored is origin-relative;
//      a scraper needs an absolute URL. The layout's US-001 `metadataBase` is
//      what makes up the difference, so the two halves are composed here the
//      way Next composes them.

const PRESIGNED_URL =
  "https://budstack-uploads.s3.amazonaws.com/development/tenants/tenant-a/uploads/card.png?X-Amz-Signature=deadbeef";
const DURABLE_URL =
  "/api/public/images/development/tenants/tenant-a/uploads/card.png";

/** A custom domain, so expectations do not depend on NEXT_PUBLIC_BASE_DOMAIN. */
const TENANT = {
  tenantId: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
};

const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

function pngFile(name = "social-card.png"): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, {
    type: "image/png",
  });
}

function descriptor(
  size: number,
  type = "image/png",
  name = "card.png",
): OgImageFile {
  return { name, size, type };
}

/** Only `.ok` and `.json()` are read, so a full Response is not needed. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The About page's metadata with one authored ogImage. */
function aboutMetadata(ogImage: string) {
  return buildStorePageMetadata({
    pageKey: "about",
    businessName: TENANT.businessName,
    subdomain: TENANT.subdomain,
    customDomain: TENANT.customDomain,
    pageSeo: { about: { ogImage } },
    tenantId: TENANT.tenantId,
    // Basic: the branded US-018 fallback must not stand in for the authored
    // image and quietly make a dropped URL look like a working one.
    plan: "basic",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("US-019 upload — the URL that gets stored", () => {
  it("posts the file to the shared tenant upload endpoint", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ success: true, url: PRESIGNED_URL, publicUrl: DURABLE_URL }),
    );

    await uploadOgImage(pngFile());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OG_IMAGE_UPLOAD_URL);
    expect(url).toBe("/api/tenant-admin/upload");
    expect(init.method).toBe("POST");
    // FormData, not JSON: the route reads req.formData().
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("returns the durable US-005 URL, not the presigned one", async () => {
    stubFetch(
      jsonResponse({ success: true, url: PRESIGNED_URL, publicUrl: DURABLE_URL }),
    );

    await expect(uploadOgImage(pngFile())).resolves.toBe(DURABLE_URL);
  });

  it("refuses an upload that has no durable URL rather than fall back", async () => {
    // What the route answers for a file it will not serve publicly — a PDF, or
    // an extension outside US-005's allow-list. `url` is still a working link,
    // which is exactly the trap: it works until the signature expires.
    stubFetch(jsonResponse({ success: true, url: PRESIGNED_URL, publicUrl: null }));

    await expect(uploadOgImage(pngFile())).rejects.toThrow(
      /PNG, JPEG, GIF or WebP/,
    );
  });

  // WHY the fallback is refused, proved against the renderer rather than
  // asserted in a comment: a presigned URL stored here produces NO og:image.
  // Falling back would write a value the storefront silently discards.
  it("would have rendered nothing at all if it had fallen back", () => {
    expect(storedPublicImagePath(PRESIGNED_URL)).toBeNull();
    expect(aboutMetadata(PRESIGNED_URL).openGraph?.images).toBeUndefined();
  });

  it("surfaces the route's own message when it rejects the file", async () => {
    stubFetch(
      jsonResponse({ error: "File content does not match claimed type" }, 400),
    );

    await expect(uploadOgImage(pngFile())).rejects.toThrow(
      "File content does not match claimed type",
    );
  });

  it("does not put the browser's own network error in front of the owner", async () => {
    // A dropped connection rejects with a TypeError ("Failed to fetch"), which
    // is an Error like every deliberate throw here — so without a guard it
    // reaches the toast verbatim.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(uploadOgImage(pngFile())).rejects.toThrow(
      /could not be uploaded/,
    );
  });

  it("still fails cleanly when the response is not JSON at all", async () => {
    stubFetch({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    } as unknown as Response);

    await expect(uploadOgImage(pngFile())).rejects.toThrow(
      /could not be uploaded/,
    );
  });
});

describe("US-019 upload — the client-side gate", () => {
  it("accepts a file exactly at the 5MB limit", () => {
    expect(ogImageFileError(descriptor(OG_IMAGE_MAX_BYTES))).toBeNull();
  });

  it("rejects one byte over the limit", () => {
    expect(ogImageFileError(descriptor(OG_IMAGE_MAX_BYTES + 1))).not.toBeNull();
  });

  it("names both the file's size and the limit", () => {
    const message = ogImageFileError(descriptor(8 * 1024 * 1024));
    expect(message).toContain("8.0 MB");
    expect(message).toContain("5.0 MB");
  });

  // The cap is the scrapers', not ours: the upload route would take this file.
  it("stops short of the server limit, which would accept the same file", () => {
    const tooBigForACard = { name: "card.png", size: 8 * 1024 * 1024, type: "image/png" };

    expect(ogImageFileError(tooBigForACard)).not.toBeNull();
    expect(validateUpload(tooBigForACard as unknown as File)).toEqual({
      valid: true,
    });
  });

  it("rejects a file that is not an image", () => {
    expect(
      ogImageFileError(descriptor(1024, "application/pdf", "menu.pdf")),
    ).toMatch(/PNG, JPEG, GIF or WebP/);
  });

  it("rejects SVG, which is XML and can carry script", () => {
    expect(
      ogImageFileError(descriptor(1024, "image/svg+xml", "logo.svg")),
    ).not.toBeNull();
    expect(isServablePublicImageType("image/svg+xml")).toBe(false);
  });

  it("offers the picker exactly the types it will accept", () => {
    expect(OG_IMAGE_ACCEPT.split(",")).toEqual([...OG_IMAGE_TYPES]);
  });
});

// The client list is restated rather than imported — both server modules reach
// `@/lib/api-error` or `file-type`, which have no business in a browser bundle.
// This is what stops the restatement from drifting: a type offered in the SEO
// editor that either server rule would refuse fails here, not at upload time.
describe("US-019 upload — the offered types are a subset of the server's", () => {
  it.each([...OG_IMAGE_TYPES])("%s passes the upload route's rules", (type) => {
    const file = {
      name: `card.${EXTENSION_BY_TYPE[type]}`,
      size: 1024,
      type,
    } as unknown as File;

    expect(validateUpload(file)).toEqual({ valid: true });
  });

  it.each([...OG_IMAGE_TYPES])("%s is servable by US-005's route", (type) => {
    expect(isServablePublicImageType(type)).toBe(true);
  });
});

describe("US-019 — the 1200x630 guidance", () => {
  it("says nothing about an image at the recommended size", () => {
    expect(
      ogImageSizeWarning({ width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }),
    ).toBeNull();
  });

  it("says nothing before the image has been measured", () => {
    expect(ogImageSizeWarning(null)).toBeNull();
  });

  it("warns that a small image is shown as a thumbnail, and names both sizes", () => {
    const warning = ogImageSizeWarning({ width: 400, height: 210 });

    expect(warning).toContain("400x210");
    expect(warning).toContain(`${OG_IMAGE_MIN_WIDTH}x${OG_IMAGE_MIN_HEIGHT}`);
    expect(warning).toContain(`${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT}`);
  });

  it("warns that an off-ratio image will be cropped", () => {
    const warning = ogImageSizeWarning({ width: 1000, height: 1000 });

    expect(warning).toContain("1000x1000");
    expect(warning).toContain("cropped");
  });

  // A tenth either way is the difference between 1200x630 and about 1200x700 —
  // visible, but not yet a headline sliced in half.
  it("tolerates a near-miss on the ratio", () => {
    expect(ogImageSizeWarning({ width: 1200, height: 660 })).toBeNull();
  });

  it("is a warning, never a rejection — the file still uploads", () => {
    // The size rules and the ratio rules are separate: an off-ratio file that
    // is within the byte cap and an offered type has nothing blocking it.
    expect(ogImageFileError(descriptor(1024))).toBeNull();
    expect(ogImageSizeWarning({ width: 1000, height: 1000 })).not.toBeNull();
  });

  it("ignores a measurement that is not one", () => {
    expect(ogImageSizeWarning({ width: 0, height: 0 })).toBeNull();
  });
});

// What is stored is origin-relative (US-005 generates it that way, and the
// storefront CSP is why). A scraper needs an absolute URL. These two halves are
// composed by Next — the layout's metadataBase resolves the page's relative
// image — so they are composed here the same way.
describe("US-019 — the og:image a scraper actually reads", () => {
  it("carries an uploaded image through the page builder untouched", () => {
    expect(aboutMetadata(DURABLE_URL).openGraph?.images).toEqual([DURABLE_URL]);
  });

  it("resolves to an absolute URL on the tenant's own host", () => {
    const layout = buildStoreMetadata({
      tenantId: TENANT.tenantId,
      businessName: TENANT.businessName,
      subdomain: TENANT.subdomain,
      customDomain: TENANT.customDomain,
      settings: null,
      faviconRef: null,
    });

    const images = aboutMetadata(DURABLE_URL).openGraph?.images as string[];
    const resolved = new URL(images[0], layout.metadataBase as URL);

    expect(resolved.toString()).toBe(`https://shop.example${DURABLE_URL}`);
    expect(resolved.protocol).toBe("https:");
  });

  it("resolves against the subdomain when the tenant has no custom domain", () => {
    const layout = buildStoreMetadata({
      tenantId: TENANT.tenantId,
      businessName: TENANT.businessName,
      subdomain: TENANT.subdomain,
      customDomain: null,
      settings: null,
      faviconRef: null,
    });

    const resolved = new URL(DURABLE_URL, layout.metadataBase as URL);

    expect(resolved.host).toBe(
      `${TENANT.subdomain}.${process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io"}`,
    );
    expect(resolved.pathname).toBe(DURABLE_URL);
  });
});
