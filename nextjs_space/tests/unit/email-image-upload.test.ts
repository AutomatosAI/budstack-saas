import { afterEach, describe, expect, it, vi } from "vitest";

// The module under test toasts its failures. Nothing asserted here goes through
// that path, but importing the real one drags react-dom into a node-env test.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

import {
  createSequentialQueue,
  EMAIL_IMAGE_MAX_BYTES,
  EMAIL_IMAGE_TYPES,
  emailImageAlt,
  emailImageFileError,
  uploadEmailImage,
  type EmailImageFile,
} from "@/components/admin/email/email-image-upload";
import { constrainEmailImageWidth } from "@/lib/email/email-image-node";
import {
  EMAIL_CARD_WIDTH_PX,
  EMAIL_CONTENT_PADDING_PX,
  EMAIL_CONTENT_WIDTH_PX,
} from "@/lib/email/email-layout";
import { parseEmailContentJson } from "@/lib/email/email-content-json";
import { renderEmailTemplateHtml } from "@/lib/email/email-render-pipeline";
import type { EmailShellTenant } from "@/lib/email/email-shell";
import { isServablePublicImageType } from "@/lib/storage/public-image-url";
import { validateUpload } from "@/lib/storage/upload-validation";

// Email Phase 2 US-014 — dropping or picking an image in the composer.
//
// Three things decide whether an image an author inserts is still there when
// the message is read, and each is asserted against the real thing rather than
// against this story's own source:
//
//   1. THE URL THAT GETS STORED. `/api/tenant-admin/upload` returns two
//      addresses for one object and one of them dies in an hour. Taking the
//      wrong one produces an image that works in every preview and 403s in the
//      inbox, so the presigned `url` is refused even when the durable one is
//      missing.
//   2. THE TYPES ON OFFER. The client list is restated, not imported (bundle
//      safety), so it is walked through BOTH server modules that would refuse a
//      type — the upload route's rules and US-005's servable set.
//   3. THE WIDTH THAT SURVIVES. `max-width` is CSS and Outlook renders through
//      Word, which ignores it. The `width` attribute is the instruction that
//      lands, so it is followed through juice and the sanitizer, and the column
//      it is clamped to is read back out of the shell that produces it.

const UPLOAD_URL = "/api/tenant-admin/upload";
const PRESIGNED_URL =
  "https://budstack-uploads.s3.amazonaws.com/development/tenants/tenant-a/uploads/photo.png?X-Amz-Signature=deadbeef";
const DURABLE_URL =
  "/api/public/images/development/tenants/tenant-a/uploads/photo.png";

/** A custom domain, so expectations do not depend on NEXT_PUBLIC_BASE_DOMAIN. */
const TENANT: EmailShellTenant = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  primaryColor: "#7c3aed",
};

const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

function pngFile(name = "summer-range.png"): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, {
    type: "image/png",
  });
}

function descriptor(
  size: number,
  type = "image/png",
  name = "photo.png",
): EmailImageFile {
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

function renderForTenant(content: unknown[]) {
  return renderEmailTemplateHtml({
    contentJson: parseEmailContentJson({ type: "doc", content }),
    tenant: TENANT,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("US-014 upload — the URL that gets stored", () => {
  it("posts the file to the endpoint it was given", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ success: true, url: PRESIGNED_URL, publicUrl: DURABLE_URL }),
    );

    await uploadEmailImage(pngFile(), UPLOAD_URL);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(UPLOAD_URL);
    expect(init.method).toBe("POST");
    // FormData, not JSON: the route reads req.formData().
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("returns the durable US-005 URL, not the presigned one", async () => {
    stubFetch(
      jsonResponse({ success: true, url: PRESIGNED_URL, publicUrl: DURABLE_URL }),
    );

    await expect(uploadEmailImage(pngFile(), UPLOAD_URL)).resolves.toBe(
      DURABLE_URL,
    );
  });

  it("refuses an upload that has no durable URL rather than fall back", async () => {
    // What the route answers for a file it will not serve publicly — a PDF, or
    // an extension outside US-005's allow-list. `url` is still a working link,
    // which is exactly the trap: it works until the signature expires.
    stubFetch(
      jsonResponse({ success: true, url: PRESIGNED_URL, publicUrl: null }),
    );

    await expect(
      uploadEmailImage(pngFile("brochure.png"), UPLOAD_URL),
    ).rejects.toThrow(/PNG, JPEG, GIF or WebP/);
  });

  it("surfaces the route's own message when it rejects the file", async () => {
    stubFetch(jsonResponse({ error: "File content does not match claimed type" }, 400));

    await expect(uploadEmailImage(pngFile(), UPLOAD_URL)).rejects.toThrow(
      "File content does not match claimed type",
    );
  });

  it("does not put the browser's own network error in front of the author", async () => {
    // A dropped connection rejects with a TypeError ("Failed to fetch"), which
    // is an Error like every deliberate throw here — so without a guard it
    // reaches the toast verbatim.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(uploadEmailImage(pngFile(), UPLOAD_URL)).rejects.toThrow(
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

    await expect(uploadEmailImage(pngFile(), UPLOAD_URL)).rejects.toThrow(
      /could not be uploaded/,
    );
  });
});

// Two drops in quick succession are two calls into the hook. Without a queue
// their loops interleave and images land in whichever order the network
// settled — the same failure uploading one file at a time inside a batch was
// added to prevent, just one level up.
describe("US-014 upload — batches run one after another", () => {
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  it("holds a second batch until the first has finished", async () => {
    const enqueue = createSequentialQueue();
    const order: string[] = [];
    const first = deferred();

    const a = enqueue(async () => {
      order.push("a:start");
      await first.promise;
      order.push("a:end");
    });
    const b = enqueue(async () => {
      order.push("b:start");
    });

    // A queued task starts on a microtask, so let the pending ones run: `a` is
    // then mid-flight, and `b` — handed over while it was — has not begun.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(["a:start"]);

    first.resolve();
    await Promise.all([a, b]);

    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("keeps running after a batch fails, and still reports that failure", async () => {
    const enqueue = createSequentialQueue();

    const failed = enqueue(async () => {
      throw new Error("upload exploded");
    });

    await expect(failed).rejects.toThrow("upload exploded");
    await expect(enqueue(async () => "next")).resolves.toBe("next");
  });
});

describe("US-014 upload — the client-side gate", () => {
  it("accepts a file exactly at the 2MB limit", () => {
    expect(emailImageFileError(descriptor(EMAIL_IMAGE_MAX_BYTES))).toBeNull();
  });

  it("rejects one byte over the limit", () => {
    expect(emailImageFileError(descriptor(EMAIL_IMAGE_MAX_BYTES + 1))).not.toBeNull();
  });

  it("names both the file's size and the limit", () => {
    const message = emailImageFileError(descriptor(4 * 1024 * 1024));
    expect(message).toContain("4.0 MB");
    expect(message).toContain("2.0 MB");
  });

  it("rejects a file that is not an image", () => {
    expect(emailImageFileError(descriptor(1024, "application/pdf", "menu.pdf"))).toMatch(
      /PNG, JPEG, GIF or WebP/,
    );
  });

  it("rejects SVG, which is XML and can carry script", () => {
    expect(
      emailImageFileError(descriptor(1024, "image/svg+xml", "logo.svg")),
    ).not.toBeNull();
    expect(isServablePublicImageType("image/svg+xml")).toBe(false);
  });
});

// The client list is restated rather than imported — both server modules reach
// `@/lib/api-error` or `file-type`, which have no business in a browser bundle.
// This is what stops the restatement from drifting: a type offered in the
// composer that either server rule would refuse fails here, not at upload time.
describe("US-014 upload — the offered types are a subset of the server's", () => {
  it.each([...EMAIL_IMAGE_TYPES])("%s passes the upload route's rules", (type) => {
    const file = {
      name: `photo.${EXTENSION_BY_TYPE[type]}`,
      size: 1024,
      type,
    } as unknown as File;

    expect(validateUpload(file)).toEqual({ valid: true });
  });

  it.each([...EMAIL_IMAGE_TYPES])("%s is servable by US-005's route", (type) => {
    expect(isServablePublicImageType(type)).toBe(true);
  });
});

describe("US-014 — alt text from a filename", () => {
  it("drops the extension and reads separators as spaces", () => {
    expect(emailImageAlt("summer-range_2.jpg")).toBe("summer range 2");
  });

  it("leaves a plain name alone", () => {
    expect(emailImageAlt("photo.png")).toBe("photo");
  });
});

describe("US-014 — the width an image is constrained to", () => {
  it("clamps a photo wider than the column", () => {
    expect(constrainEmailImageWidth(4000)).toBe(EMAIL_CONTENT_WIDTH_PX);
  });

  it("never upscales an image narrower than the column", () => {
    expect(constrainEmailImageWidth(120)).toBe(120);
  });

  it("rounds a fractional measurement", () => {
    expect(constrainEmailImageWidth(120.6)).toBe(121);
  });

  it.each([[0], [-5], [Number.NaN], [null], [undefined]])(
    "is null (unsized, the pre-US-014 behaviour) for %s",
    (value) => {
      expect(constrainEmailImageWidth(value)).toBeNull();
    },
  );

  it("is the shell's own column, not a number copied out of it", async () => {
    const html = await renderForTenant([
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ]);

    // If the shell is ever re-laid-out, these fail together and the constant is
    // wrong rather than silently stale.
    expect(html).toContain(`max-width:${EMAIL_CARD_WIDTH_PX}px`);
    expect(html).toContain(`padding-left:${EMAIL_CONTENT_PADDING_PX}px`);
    expect(EMAIL_CONTENT_WIDTH_PX).toBe(
      EMAIL_CARD_WIDTH_PX - EMAIL_CONTENT_PADDING_PX * 2,
    );
  });
});

describe("US-014 — an uploaded image through the real save pipeline", () => {
  const uploaded = (width: number | null) => ({
    type: "image",
    attrs: { src: DURABLE_URL, alt: "Summer range", width },
  });

  it("keeps the width attribute through juice and the sanitizer", async () => {
    const html = await renderForTenant([uploaded(EMAIL_CONTENT_WIDTH_PX)]);

    expect(html).toContain(`width="${EMAIL_CONTENT_WIDTH_PX}"`);
    expect(html).toContain('alt="Summer range"');
  });

  it("absolutises the durable path against the tenant's own host", async () => {
    const html = await renderForTenant([uploaded(EMAIL_CONTENT_WIDTH_PX)]);

    // An inbox has no origin: the stored src is origin-relative and only the
    // save path knows which host the message claims to come from.
    expect(html).toContain(`src="https://shop.example${DURABLE_URL}"`);
    expect(html).not.toContain(`src="${DURABLE_URL}"`);
  });

  it("renders no width attribute when the image could not be measured", async () => {
    const html = await renderForTenant([uploaded(null)]);

    expect(html).toContain(`src="https://shop.example${DURABLE_URL}"`);
    expect(html).not.toMatch(/<img[^>]*width=/);
  });

  it("clamps a width the composer never wrote", async () => {
    // contentJson arrives in a request body — the composer is not the only way
    // a document can be written, so the render path clamps too.
    const html = await renderForTenant([uploaded(999_999)]);

    expect(html).toContain(`width="${EMAIL_CONTENT_WIDTH_PX}"`);
    expect(html).not.toContain("999999");
  });

  it("emits a width as a number or not at all, never as the string it was given", async () => {
    const injected = await renderForTenant([
      {
        type: "image",
        attrs: { src: DURABLE_URL, alt: "Summer range", width: '300" onerror="x' },
      },
    ]);

    // The value is parsed to a number before it is written, so everything after
    // the leading digits is gone before the attribute exists — the sanitizer
    // never has to be the thing that saves this.
    expect(injected).toContain('width="300"');
    expect(injected).not.toContain("onerror");

    const nonsense = await renderForTenant([
      {
        type: "image",
        attrs: { src: DURABLE_URL, alt: "Summer range", width: "not-a-number" },
      },
    ]);

    expect(nonsense).not.toMatch(/<img[^>]*width=/);
  });
});
