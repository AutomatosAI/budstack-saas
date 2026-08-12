import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

import {
  EMAIL_MAX_INLINE_IMAGE_BYTES,
  emailContentJsonSchema,
  normaliseEmailContentJson,
  parseEmailContentJson,
  type EmailContentJson,
} from "@/lib/email/email-content-json";
import {
  BUSINESS_NAME_SLOT,
  EMAIL_BODY_CLASS,
  emailCategoryOfTemplate,
  renderEmailTemplateHtml,
} from "@/lib/email/email-render-pipeline";
import { UNSUBSCRIBE_URL_SLOT, type EmailShellTenant } from "@/lib/email/email-shell";
import { registerEmailHelpers } from "@/lib/email/handlebars-helpers";
import {
  EMAIL_HTML_MAX_LENGTH,
  sanitizeEmailHtml,
} from "@/lib/security/email-sanitize";

// Email Phase 2 US-011 — the save-path pipeline. Four properties carry it:
//
//   1. THE WORKER IS UNTOUCHED. Literal {{tags}} come out the far end verbatim
//      and the same Handlebars.compile scripts/email-worker.ts already runs
//      still fills them. Asserted by actually compiling the output.
//   2. SANITIZE IS LAST. juice writes style attributes; anything that inlined
//      after sanitizing would be CSS the allow-list never saw.
//   3. EVERY image src that survives is absolute (an inbox has no origin) or a
//      small inline image — and an image that can be neither is an error the
//      author is told about, never a silent drop.
//   4. The shell wraps both levels: a tenant's branding for a tenant template,
//      the {{businessName}} slot for a system one.

/** A custom domain, so expectations do not depend on NEXT_PUBLIC_BASE_DOMAIN. */
const TENANT: EmailShellTenant = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  logoUrl: "development/tenants/tenant-a/uploads/logo.png",
  primaryColor: "#7c3aed",
  businessAddress1: "1 Sample Street",
  businessCity: "Dublin",
};

const BASE_URL = "https://shop.example";

function doc(...content: unknown[]): EmailContentJson {
  return parseEmailContentJson({ type: "doc", content });
}

function paragraph(...text: string[]) {
  return {
    type: "paragraph",
    content: text.map((value) => ({ type: "text", text: value })),
  };
}

function image(src: string, alt = "An image") {
  return { type: "image", attrs: { src, alt } };
}

/** A data: URL whose DECODED payload is exactly `bytes` long. */
function inlineImage(bytes: number, mime = "image/png"): string {
  return `data:${mime};base64,${Buffer.alloc(bytes, 0x41).toString("base64")}`;
}

function renderForTenant(
  content: unknown[],
  options: { tenant?: EmailShellTenant | null; category?: "marketing" | "transactional" } = {},
) {
  return renderEmailTemplateHtml({
    contentJson: doc(...content),
    tenant: options.tenant === undefined ? TENANT : options.tenant,
    category: options.category,
  });
}

describe("US-011 pipeline — the worker contract", () => {
  it("passes literal {{tags}} through every step verbatim", async () => {
    const html = await renderForTenant([
      paragraph("Hi {{userName}}, order {{orderNumber}} shipped."),
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [{ type: "link", attrs: { href: "https://shop.example/o/{{orderNumber}}" } }],
            text: "Track it",
          },
        ],
      },
      image("https://cdn.example/hero.png", "{{businessName}} hero"),
    ]);

    expect(html).toContain("Hi {{userName}}, order {{orderNumber}} shipped.");
    expect(html).toContain("https://shop.example/o/{{orderNumber}}");
    expect(html).toContain('alt="{{businessName}} hero"');
  });

  it("still compiles with the worker's Handlebars, helpers and all", async () => {
    const html = await renderForTenant([
      paragraph("Hi {{userName}}."),
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "{{#each items}}{{this.name}} {{/each}}" }],
              },
            ],
          },
        ],
      },
    ]);

    // The worker builds its Handlebars exactly this way (scripts/email-worker.ts).
    const handlebars = Handlebars.create();
    registerEmailHelpers(handlebars);
    const compiled = handlebars.compile(html)({
      userName: "Ada",
      items: [{ name: "Flower" }, { name: "Oil" }],
      unsubscribeUrl: "https://shop.example/unsub/tok",
    });

    expect(compiled).toContain("Hi Ada.");
    expect(compiled).toContain("Flower Oil");
    expect(compiled).not.toContain("{{");
  });

  it("leaves the unsubscribe slot for the fan-out step to fill", async () => {
    const html = await renderForTenant([paragraph("News")], { category: "marketing" });
    expect(html).toContain(UNSUBSCRIBE_URL_SLOT);
  });
});

describe("US-011 pipeline — sanitize runs last", () => {
  it("emits a document that is already fully sanitized", async () => {
    const html = await renderForTenant([
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hello" }] },
      paragraph("Body copy."),
    ]);

    // Idempotence: a second pass changes nothing, so nothing entered the
    // document after the allow-list ran.
    expect(sanitizeEmailHtml(html)).toBe(html);
  });

  it("inlines the body stylesheet onto the elements before sanitizing", async () => {
    const html = await renderForTenant([paragraph("Body copy.")]);

    // The rule only exists in the stylesheet juice is handed; finding it on the
    // element proves inlining happened, and finding it AFTER sanitization
    // proves the declaration is inside the allow-list.
    expect(html).toContain(`class="${EMAIL_BODY_CLASS}"`);
    expect(html).toMatch(/<p style="[^"]*font-size:16px[^"]*">Body copy\.<\/p>/);
  });

  it("strips script, event handlers and javascript: URLs from hostile content", async () => {
    const html = await renderForTenant([
      paragraph("<script>alert(1)</script>"),
      paragraph("<img src=x onerror=alert(1)>"),
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            text: "Click",
          },
        ],
      },
      {
        // Unknown attributes are not in the node spec, so ProseMirror never
        // serialises them — belt to the sanitizer's braces.
        type: "paragraph",
        attrs: { onclick: "alert(1)" },
        content: [{ type: "text", text: "Plain" }],
      },
    ]);

    expect(html).not.toContain("<script");
    // No event handler in ATTRIBUTE position anywhere in the document. Asserted
    // as a shape rather than as a substring: the fixture's `onerror` also
    // appears as escaped TEXT below, which is exactly what should happen to it.
    expect(html).not.toMatch(/<[a-z]+[^>]*\son[a-z]+\s*=/i);
    expect(html.toLowerCase()).not.toContain("javascript:");
    // Escaped, not dropped: the author's literal text still reads back, and the
    // link survives with its javascript: href removed rather than the whole
    // element disappearing under the author.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain(">Click</a>");
  });
});

describe("US-011 pipeline — image sources", () => {
  it("absolutises US-005's origin-relative durable path", async () => {
    const html = await renderForTenant([
      image("/api/public/images/tenants/tenant-a/uploads/hero.png"),
    ]);
    expect(html).toContain(
      `src="${BASE_URL}/api/public/images/tenants/tenant-a/uploads/hero.png"`,
    );
  });

  it("absolutises a bare S3 key the same way the logo is", async () => {
    const html = await renderForTenant([
      image("development/tenants/tenant-a/uploads/hero.png"),
    ]);
    expect(html).toContain(
      `src="${BASE_URL}/api/public/images/development/tenants/tenant-a/uploads/hero.png"`,
    );
  });

  it("leaves an already-absolute URL alone", async () => {
    const html = await renderForTenant([image("https://cdn.example/hero.png")]);
    expect(html).toContain('src="https://cdn.example/hero.png"');
  });

  it.each([
    // Resolves against the PAGE's scheme, which an inbox does not have — and
    // the sanitizer drops it anyway (allowProtocolRelative: false).
    ["scheme-relative", "//cdn.example/hero.png"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["an empty source", "   "],
    // Not on US-005's served-image allow-list, so there is no durable route to
    // build: SVG is XML and can carry script, and .txt is not an image at all.
    ["an SVG key", "tenants/tenant-a/uploads/logo.svg"],
    ["a non-image key", "tenants/tenant-a/uploads/notes.txt"],
  ])("rejects %s rather than mailing a dead image", async (_label, src) => {
    await expect(renderForTenant([image(src)])).rejects.toThrow(
      /full web address/,
    );
  });

  it("treats any other bare path as an S3 key, the shape the DB stores", async () => {
    // `tenant_branding.logoUrl` and `uploadFile` both deal in bare keys, so a
    // src that is neither absolute nor origin-relative is read as one — the
    // same rule US-010 applies to the logo. The result is still ABSOLUTE, which
    // is the property that matters for an inbox; whether that key exists is the
    // public-image route's 404 to give, not this pipeline's to guess at.
    const html = await renderForTenant([image("hero.png")]);
    expect(html).toContain(`src="${BASE_URL}/api/public/images/hero.png"`);
  });

  it("keeps an inline image at the size limit", async () => {
    const src = inlineImage(EMAIL_MAX_INLINE_IMAGE_BYTES);
    const html = await renderForTenant([image(src)]);
    expect(html).toContain(src);
  });

  it("rejects a pasted image over the size limit with the fix in the message", async () => {
    await expect(
      renderForTenant([image(inlineImage(EMAIL_MAX_INLINE_IMAGE_BYTES + 1))]),
    ).rejects.toThrow(/too large to embed .*Upload it instead/s);
  });

  it("rejects an inline SVG, which is XML and can carry script", async () => {
    await expect(
      renderForTenant([image("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")]),
    ).rejects.toThrow(/format email clients cannot show/);
  });

  it("rejects a data: URL that is not an image at all", async () => {
    await expect(
      renderForTenant([image("data:text/html;base64,PGgxPmhpPC9oMT4=")]),
    ).rejects.toThrow(/format email clients cannot show/);
  });

  it("keeps a three-image document well under the stored size cap", async () => {
    const html = await renderForTenant([
      paragraph("Our new drop is live."),
      image("https://cdn.example/one.png"),
      paragraph("Second look:"),
      image("/api/public/images/tenants/tenant-a/uploads/two.png"),
      paragraph("And the last one:"),
      image("development/tenants/tenant-a/uploads/three.jpg"),
    ]);

    expect(html.length).toBeLessThan(EMAIL_HTML_MAX_LENGTH);
    expect(html.match(/<img/g)).toHaveLength(4); // three authored + the logo
  });
});

describe("US-011 pipeline — the shell it wraps in", () => {
  it("uses the tenant's own branding for a tenant template", async () => {
    const html = await renderForTenant([paragraph("Hi")]);

    expect(html).toContain("Healing Buds");
    expect(html).toContain("1 Sample Street, Dublin");
    expect(html).toContain("#7c3aed");
    expect(html).toContain(
      `src="${BASE_URL}/api/public/images/development/tenants/tenant-a/uploads/logo.png"`,
    );
  });

  it("carries the {{businessName}} slot for a system template", async () => {
    const html = await renderEmailTemplateHtml({
      contentJson: doc(paragraph("Hi")),
      tenant: null,
      category: "marketing",
    });

    // A system template is mailed on behalf of whichever tenant the worker
    // resolves it for, so the name is a slot the worker fills — never one
    // tenant's name baked into every tenant's mail.
    expect(html).toContain(BUSINESS_NAME_SLOT);
    expect(html).not.toContain("Healing Buds");
    // No logo, so no base URL is guessed at from an empty subdomain.
    expect(html).not.toContain("budstacks.io");
    expect(html).toContain(UNSUBSCRIBE_URL_SLOT);
  });

  it("requires absolute image URLs in a system template, which has no origin", async () => {
    await expect(
      renderEmailTemplateHtml({
        contentJson: doc(image("/api/public/images/tenants/tenant-a/uploads/x.png")),
        tenant: null,
      }),
    ).rejects.toThrow(/full web address/);

    const html = await renderEmailTemplateHtml({
      contentJson: doc(image("https://cdn.example/x.png")),
      tenant: null,
    });
    expect(html).toContain('src="https://cdn.example/x.png"');
  });

  it("offers unsubscribe only for marketing", async () => {
    const marketing = await renderForTenant([paragraph("Hi")], { category: "marketing" });
    const transactional = await renderForTenant([paragraph("Hi")], {
      category: "transactional",
    });
    const unspecified = await renderForTenant([paragraph("Hi")]);

    expect(marketing).toContain(UNSUBSCRIBE_URL_SLOT);
    expect(transactional).not.toContain(UNSUBSCRIBE_URL_SLOT);
    // Absent category means transactional — the same tolerance rule the queue
    // payload uses, so a legacy template gets no opt-out link on a receipt.
    expect(unspecified).not.toContain(UNSUBSCRIBE_URL_SLOT);
  });
});

describe("US-011 — category of a template row", () => {
  it.each([
    ["Marketing", "marketing"],
    ["marketing", "marketing"],
    ["  MARKETING  ", "marketing"],
    ["Transactional", "transactional"],
    ["Newsletter", "transactional"],
    [null, "transactional"],
    [undefined, "transactional"],
  ])("maps %s to %s", (stored, expected) => {
    expect(emailCategoryOfTemplate(stored)).toBe(expected);
  });
});

describe("US-011 — contentJson at the request boundary", () => {
  it("accepts an empty document", () => {
    expect(emailContentJsonSchema.safeParse({ type: "doc" }).success).toBe(true);
    expect(
      emailContentJsonSchema.safeParse({ type: "doc", content: [] }).success,
    ).toBe(true);
  });

  it.each([
    ["a non-document root", { type: "paragraph" }],
    ["content that is not an array", { type: "doc", content: "hello" }],
    ["a bare string", "hello"],
    ["null", null],
    ["a non-JSON attribute value", { type: "doc", content: [{ type: "image", attrs: { src: () => "x" } }] }],
  ])("rejects %s", (_label, value) => {
    expect(emailContentJsonSchema.safeParse(value).success).toBe(false);
    expect(() => parseEmailContentJson(value)).toThrow(/could not be read/);
  });

  it("refuses a document nested past the depth cap without overflowing", () => {
    // z.lazy validates by recursion, so an over-deep payload would blow the
    // stack INSIDE safeParse and throw a RangeError — which lib/validation/body
    // does not expect and which surfaces as a 500 on plainly bad input. The
    // guard runs first, so this stays a clean rejection. 900 nests is ~22KB,
    // far under the 512KB the routes accept.
    let node: unknown = { type: "paragraph" };
    for (let i = 0; i < 900; i += 1) node = { type: "blockquote", content: [node] };

    const result = emailContentJsonSchema.safeParse({ type: "doc", content: [node] });

    expect(result.success).toBe(false);
    expect(() => parseEmailContentJson({ type: "doc", content: [node] })).toThrow(
      /could not be read/,
    );
  });

  it("still accepts nesting a real author could produce", () => {
    let node: unknown = {
      type: "paragraph",
      content: [{ type: "text", text: "Deep but legal" }],
    };
    for (let i = 0; i < 8; i += 1) node = { type: "blockquote", content: [node] };

    expect(
      emailContentJsonSchema.safeParse({ type: "doc", content: [node] }).success,
    ).toBe(true);
  });

  it("normalises without mutating the caller's document", () => {
    const original = doc(image("/api/public/images/tenants/tenant-a/uploads/a.png"));
    const before = JSON.stringify(original);

    const normalised = normaliseEmailContentJson(original, BASE_URL);

    expect(JSON.stringify(original)).toBe(before);
    expect(normalised).not.toBe(original);
    expect(normalised.content?.[0].attrs?.src).toBe(
      `${BASE_URL}/api/public/images/tenants/tenant-a/uploads/a.png`,
    );
  });

  it("normalises images nested inside other nodes", () => {
    const nested = doc({
      type: "blockquote",
      content: [image("/api/public/images/tenants/tenant-a/uploads/deep.png")],
    });

    const normalised = normaliseEmailContentJson(nested, BASE_URL);
    const inner = normalised.content?.[0].content?.[0];

    expect(inner?.attrs?.src).toBe(
      `${BASE_URL}/api/public/images/tenants/tenant-a/uploads/deep.png`,
    );
  });
});
