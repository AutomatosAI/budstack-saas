import { describe, expect, it } from "vitest";

import {
  absoluteEmailImageUrl,
  absoluteEmailUrl,
} from "@/lib/email/email-asset-url";
import {
  UNSUBSCRIBE_URL_SLOT,
  renderEmailBody,
  resolveBusinessAddress,
  type EmailShellTenant,
} from "@/lib/email/email-shell";
import { sanitizeEmailHtml } from "@/lib/security/email-sanitize";

// Email Phase 2 US-010 — the branded shell. Four properties carry the weight:
//   1. every asset URL that leaves for an inbox is ABSOLUTE (US-005's durable
//      image path is origin-relative by design and an inbox has no origin);
//   2. the unsubscribe line appears for marketing and ONLY for marketing;
//   3. the whole document survives lib/security/email-sanitize.ts unchanged in
//      the parts that matter — the shell bends to the sanitizer, never the
//      reverse — and `{{unsubscribeUrl}}` survives it VERBATIM so the worker's
//      existing Handlebars.compile still fills it;
//   4. the render is deterministic, so the snapshot below means something.

/**
 * A custom domain rather than a subdomain, so the expected base URL does not
 * depend on NEXT_PUBLIC_BASE_DOMAIN and the snapshot is stable everywhere.
 */
const TENANT: EmailShellTenant = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  logoUrl: "development/tenants/tenant-a/uploads/1712-logo.png",
  primaryColor: "#7c3aed",
  businessAddress1: "1 Sample Street",
  businessCity: "Dublin",
  businessPostalCode: "D01 X4X4",
  businessCountry: "Ireland",
};

const BASE_URL = "https://shop.example";
const BODY = "<h1>Autumn drop</h1><p>Three new strains are in stock.</p>";

describe("absoluteEmailUrl", () => {
  it("leaves an already-absolute URL alone", () => {
    expect(absoluteEmailUrl("https://cdn.example/a.png", BASE_URL)).toBe(
      "https://cdn.example/a.png",
    );
    expect(absoluteEmailUrl("http://cdn.example/a.png", BASE_URL)).toBe(
      "http://cdn.example/a.png",
    );
  });

  it("prefixes an origin-relative path with the tenant base URL", () => {
    expect(absoluteEmailUrl("/api/public/images/a.png", BASE_URL)).toBe(
      `${BASE_URL}/api/public/images/a.png`,
    );
  });

  it.each([
    ["a scheme-relative URL an inbox cannot resolve", "//cdn.example/a.png"],
    ["a bare relative path", "images/a.png"],
    ["a data URI", "data:image/png;base64,AAAA"],
    ["an empty string", "   "],
  ])("drops %s rather than emit a broken link", (_label, input) => {
    expect(absoluteEmailUrl(input, BASE_URL)).toBeNull();
  });

  it("treats null and undefined as no URL", () => {
    expect(absoluteEmailUrl(null, BASE_URL)).toBeNull();
    expect(absoluteEmailUrl(undefined, BASE_URL)).toBeNull();
  });
});

describe("absoluteEmailImageUrl", () => {
  it("routes a stored S3 key through US-005's durable public path", () => {
    expect(absoluteEmailImageUrl(TENANT.logoUrl, BASE_URL)).toBe(
      `${BASE_URL}/api/public/images/development/tenants/tenant-a/uploads/1712-logo.png`,
    );
  });

  it("percent-encodes each key segment so odd filenames round-trip", () => {
    expect(
      absoluteEmailImageUrl("development/tenants/t/uploads/a b%c.png", BASE_URL),
    ).toBe(`${BASE_URL}/api/public/images/development/tenants/t/uploads/a%20b%25c.png`);
  });

  it("drops a key with no durable route — SVG is not served by US-005", () => {
    expect(
      absoluteEmailImageUrl("development/tenants/t/uploads/logo.svg", BASE_URL),
    ).toBeNull();
    expect(
      absoluteEmailImageUrl("development/tenants/t/uploads/deck.pdf", BASE_URL),
    ).toBeNull();
  });

  it("still handles the URL shapes a template default can carry", () => {
    expect(absoluteEmailImageUrl("https://cdn.example/a.png", BASE_URL)).toBe(
      "https://cdn.example/a.png",
    );
    expect(absoluteEmailImageUrl("/api/public/images/a.png", BASE_URL)).toBe(
      `${BASE_URL}/api/public/images/a.png`,
    );
  });
});

describe("resolveBusinessAddress", () => {
  it("prefers the settings key, which an operator sets deliberately", () => {
    expect(
      resolveBusinessAddress({
        ...TENANT,
        settings: { businessAddress: "Registered office, 4 Other Road, Cork" },
      }),
    ).toBe("Registered office, 4 Other Road, Cork");
  });

  it("falls back to the postal columns the profile form already writes", () => {
    expect(resolveBusinessAddress(TENANT)).toBe(
      "1 Sample Street, Dublin, D01 X4X4, Ireland",
    );
  });

  it("ignores a blank settings key rather than printing an empty footer line", () => {
    expect(resolveBusinessAddress({ ...TENANT, settings: { businessAddress: "  " } })).toBe(
      "1 Sample Street, Dublin, D01 X4X4, Ireland",
    );
  });

  it("returns null when the tenant has no address at all", () => {
    expect(
      resolveBusinessAddress({
        businessName: "Nowhere",
        subdomain: "nowhere",
        customDomain: null,
      }),
    ).toBeNull();
  });

  it("survives a malformed settings blob without throwing into the render", () => {
    expect(resolveBusinessAddress({ ...TENANT, settings: "not-an-object" })).toBe(
      "1 Sample Street, Dublin, D01 X4X4, Ireland",
    );
  });
});

describe("renderEmailBody", () => {
  it("renders a deterministic document for a fixture tenant", async () => {
    const [first, second] = await Promise.all([
      renderEmailBody(BODY, TENANT, { category: "marketing" }),
      renderEmailBody(BODY, TENANT, { category: "marketing" }),
    ]);

    expect(first).toBe(second);
    expect(first).toMatchSnapshot();
  });

  it("places the authored body inside the shell untouched", async () => {
    const html = await renderEmailBody(BODY, TENANT);

    expect(html).toContain("<h1>Autumn drop</h1>");
    expect(html).toContain("<p>Three new strains are in stock.</p>");
  });

  it("mails the logo as an absolute URL, never US-005's relative path", async () => {
    const html = await renderEmailBody(BODY, TENANT);

    expect(html).toContain(
      `src="${BASE_URL}/api/public/images/development/tenants/tenant-a/uploads/1712-logo.png"`,
    );
    expect(html).not.toContain('src="/api/public/images/');
  });

  it("falls back to a wordmark in the brand colour when there is no logo", async () => {
    const html = await renderEmailBody(BODY, { ...TENANT, logoUrl: null });

    expect(html).not.toContain("<img");
    expect(html).toContain("Healing Buds");
    expect(html).toContain("#7c3aed");
  });

  it("prints the business name and postal address in the footer", async () => {
    const html = await renderEmailBody(BODY, TENANT);

    expect(html).toContain("Healing Buds");
    expect(html).toContain("1 Sample Street, Dublin, D01 X4X4, Ireland");
  });

  it("emits the unsubscribe slot for a marketing message", async () => {
    const html = await renderEmailBody(BODY, TENANT, { category: "marketing" });

    expect(html).toContain(`href="${UNSUBSCRIBE_URL_SLOT}"`);
    expect(html).toContain("Unsubscribe");
  });

  it("uses a resolved unsubscribe link when fan-out already has one", async () => {
    const url = `${BASE_URL}/api/storefront/newsletter/unsubscribe?token=abc`;
    const html = await renderEmailBody(BODY, TENANT, {
      category: "marketing",
      unsubscribeUrl: url,
    });

    expect(html).toContain(`href="${url}"`);
    expect(html).not.toContain(UNSUBSCRIBE_URL_SLOT);
  });

  it.each([
    ["an explicitly transactional message", { category: "transactional" as const }],
    ["a message with no category at all (legacy default)", {}],
  ])("offers no unsubscribe line for %s", async (_label, options) => {
    const html = await renderEmailBody(BODY, TENANT, options);

    expect(html).not.toContain("Unsubscribe");
    expect(html).not.toContain(UNSUBSCRIBE_URL_SLOT);
  });
});

describe("renderEmailBody output vs. lib/security/email-sanitize", () => {
  // The sanitizer is law: it runs LAST over the finished document and anything
  // the shell emits that it does not allow is simply gone. These assertions are
  // what stops a future style edit from silently losing the brand.
  it("keeps the shell intact through the sanitizer", async () => {
    const clean = sanitizeEmailHtml(
      await renderEmailBody(BODY, TENANT, { category: "marketing" }),
    );

    expect(clean).toContain("<h1>Autumn drop</h1>");
    expect(clean).toContain("Healing Buds");
    expect(clean).toContain("1 Sample Street, Dublin, D01 X4X4, Ireland");
    expect(clean).toContain(
      `src="${BASE_URL}/api/public/images/development/tenants/tenant-a/uploads/1712-logo.png"`,
    );
    // Brand accent bar and card chrome.
    expect(clean).toContain("background-color:#7c3aed");
    expect(clean).toContain("max-width:600px");
    expect(clean).toContain("border-color:#e5e7eb");
    // Buttons in email are styled <a>; <button> is not on the allow-list.
    expect(clean).not.toContain("<button");
  });

  it("carries {{unsubscribeUrl}} through the sanitizer verbatim", async () => {
    const clean = sanitizeEmailHtml(
      await renderEmailBody(BODY, TENANT, { category: "marketing" }),
    );

    // The worker's Handlebars.compile(contentHtml) is unchanged by this story —
    // it can only fill the slot if the slot is still exactly this string.
    expect(clean).toContain(`href="${UNSUBSCRIBE_URL_SLOT}"`);
  });

  it("does not depend on any CSS property the sanitizer strips", async () => {
    const html = await renderEmailBody(BODY, TENANT, { category: "marketing" });
    const clean = sanitizeEmailHtml(html);

    // Every property the shell sets deliberately (react-email adds its own
    // defaults, which are allowed to be dropped).
    for (const declaration of [
      "font-family:Helvetica, Arial, sans-serif",
      "padding-left:32px",
      "padding-right:32px",
      "border-style:solid",
      "border-width:1px",
      "text-align:center",
      "line-height:24px",
      "color:#6b7280",
    ]) {
      expect(clean).toContain(declaration);
    }
  });
});
