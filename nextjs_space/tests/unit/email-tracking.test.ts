import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-027 — open/click tracking, per-tenant opt-in.
//
// The properties this file exists to hold:
//
//   1. OFF IS BYTE-FOR-BYTE THE OLD PIPELINE. A store that never enabled
//      tracking saves HTML containing no pixel, no wrapped link and no mention
//      of either route — asserted through the REAL campaign save path, not just
//      the renderer underneath it.
//   2. THE UNSUBSCRIBE LINK IS NEVER WRAPPED. Links are rewritten in the
//      document, so the shell's footer is out of scope by construction; the
//      test proves the slot US-017 asserts on survives untouched.
//   3. THE WORKER'S CONTRACT IS UNCHANGED. The stored HTML carries a Handlebars
//      slot for the per-recipient token and the same compile the worker runs
//      fills it VERBATIM — the US-020 lesson, where a filled value carrying `=`
//      came out as `&#x3D;`.
//   4. A SIGNATURE, NOT AN ID. Neither route can be driven by a caller who has
//      not been handed a token this platform minted for that tenant.

const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn() },
  tenant_legal_profiles: { findFirst: vi.fn() },
  tenant_legal_documents: { findFirst: vi.fn() },
  platform_legal_templates: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { resolveCampaignContent } from "@/lib/email/campaign-content";
import { campaignRecipientVariables } from "@/lib/email/campaign-send";
import { parseEmailContentJson } from "@/lib/email/email-content-json";
import { renderEmailTemplateHtml } from "@/lib/email/email-render-pipeline";
import { UNSUBSCRIBE_URL_SLOT, type EmailShellTenant } from "@/lib/email/email-shell";
import {
  EMAIL_CLICK_TRACKING_PATH,
  EMAIL_OPEN_TRACKING_PATH,
  EMAIL_TRACKING_SETTING,
  TRACKING_TOKEN_VARIABLE,
  isEmailTrackingEnabled,
  isTrackableLinkUrl,
} from "@/lib/email/email-tracking";
import {
  applyTrackingLinks,
  trackingPixelHtml,
} from "@/lib/email/email-tracking-render";
import { renderEmailTemplate } from "@/lib/email/handlebars-helpers";
import { getTenantLegalDocument } from "@/lib/legal/tenant-policy";
import {
  encodeClickTarget,
  plausibleClickTarget,
  recipientIdFromToken,
  signClickTarget,
  signRecipientToken,
  verifiedClickTarget,
} from "@/lib/email/tracking-token";
import { sanitizeEmailHtml } from "@/lib/security/email-sanitize";

const TENANT_ID = "tenant-a";
const OTHER_TENANT_ID = "tenant-b";
const RECIPIENT_ID = "11111111-1111-1111-1111-111111111111";
const BASE_URL = "https://shop.example";
const AUTHOR_LINK = "https://shop.example/products/blue-dream";
const TRACKING_ON = { [EMAIL_TRACKING_SETTING]: true };

/** Custom domain so nothing depends on NEXT_PUBLIC_BASE_DOMAIN. */
function tenant(trackingEnabled: boolean): EmailShellTenant {
  return {
    id: TENANT_ID,
    businessName: "Healing Buds",
    subdomain: "healingbuds",
    customDomain: "shop.example",
    businessAddress1: "1 Sample Street",
    settings: trackingEnabled ? { [EMAIL_TRACKING_SETTING]: true } : {},
  };
}

function linkedParagraph(href: string) {
  return {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Have a look",
        marks: [{ type: "link", attrs: { href } }],
      },
    ],
  };
}

function doc(...content: unknown[]) {
  return parseEmailContentJson({ type: "doc", content });
}

const CONTEXT = { tenantId: TENANT_ID, baseUrl: BASE_URL };

// ── The setting ─────────────────────────────────────────────────────────────

describe("isEmailTrackingEnabled", () => {
  it("is off for a tenant that has never mentioned it", () => {
    expect(isEmailTrackingEnabled({})).toBe(false);
    expect(isEmailTrackingEnabled(null)).toBe(false);
    expect(isEmailTrackingEnabled(undefined)).toBe(false);
  });

  it("is on only for a literal true", () => {
    expect(isEmailTrackingEnabled({ [EMAIL_TRACKING_SETTING]: true })).toBe(true);
    expect(isEmailTrackingEnabled({ [EMAIL_TRACKING_SETTING]: false })).toBe(false);
    // A truthy non-boolean is a settings blob written by something that did not
    // understand the flag. Refusing it keeps the default the safe direction.
    expect(isEmailTrackingEnabled({ [EMAIL_TRACKING_SETTING]: "true" })).toBe(false);
    expect(isEmailTrackingEnabled({ [EMAIL_TRACKING_SETTING]: 1 })).toBe(false);
  });

  it("is off for a settings blob that will not parse", () => {
    // A store whose configuration cannot be read has consented to nothing.
    expect(isEmailTrackingEnabled({ customCSS: 42 })).toBe(false);
  });
});

describe("isTrackableLinkUrl", () => {
  it("accepts http(s) and nothing else", () => {
    expect(isTrackableLinkUrl("https://example.com/x")).toBe(true);
    expect(isTrackableLinkUrl("http://example.com")).toBe(true);
    // A redirect cannot deliver either of these, so wrapping one would break a
    // working link to buy a statistic.
    expect(isTrackableLinkUrl("mailto:hi@example.com")).toBe(false);
    expect(isTrackableLinkUrl("tel:+353871234567")).toBe(false);
    expect(isTrackableLinkUrl("/products")).toBe(false);
    expect(isTrackableLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isTrackableLinkUrl(null)).toBe(false);
    expect(isTrackableLinkUrl(42)).toBe(false);
  });
});

// ── Signatures ──────────────────────────────────────────────────────────────

describe("signRecipientToken / recipientIdFromToken", () => {
  it("round-trips the recipient it names", () => {
    expect(recipientIdFromToken(signRecipientToken(RECIPIENT_ID))).toBe(
      RECIPIENT_ID,
    );
  });

  it("carries no address — only the row id and a signature", () => {
    const token = signRecipientToken(RECIPIENT_ID);
    expect(token.startsWith(`${RECIPIENT_ID}.`)).toBe(true);
    expect(token).not.toContain("@");
  });

  it("rejects a token whose id was swapped for another", () => {
    const token = signRecipientToken(RECIPIENT_ID);
    const signature = token.slice(token.lastIndexOf(".") + 1);
    expect(
      recipientIdFromToken(`22222222-2222-2222-2222-222222222222.${signature}`),
    ).toBeNull();
  });

  it("rejects a forged, empty, truncated or absent signature", () => {
    expect(recipientIdFromToken(`${RECIPIENT_ID}.not-a-signature`)).toBeNull();
    expect(recipientIdFromToken(`${RECIPIENT_ID}.`)).toBeNull();
    expect(recipientIdFromToken(RECIPIENT_ID)).toBeNull();
    expect(recipientIdFromToken(`.${RECIPIENT_ID}`)).toBeNull();
    // What a message compiled after tracking was switched off carries.
    expect(recipientIdFromToken("")).toBeNull();
    expect(recipientIdFromToken(null)).toBeNull();
  });

  it("will not hash an unbounded query string", () => {
    expect(recipientIdFromToken(`${"a".repeat(5000)}.x`)).toBeNull();
  });

  it("does not accept a click signature in a recipient token", () => {
    // Purpose separation: the two are signed with the same key, so only the
    // prefix stops one being replayed as the other.
    const clickSignature = signClickTarget(TENANT_ID, RECIPIENT_ID);
    expect(recipientIdFromToken(`${RECIPIENT_ID}.${clickSignature}`)).toBeNull();
  });
});

describe("verifiedClickTarget", () => {
  it("returns the destination for a signature this platform minted", () => {
    const encoded = encodeClickTarget(AUTHOR_LINK);
    const signature = signClickTarget(TENANT_ID, AUTHOR_LINK);
    expect(verifiedClickTarget(TENANT_ID, encoded, signature)).toBe(AUTHOR_LINK);
  });

  it("refuses one store's link replayed through another", () => {
    const encoded = encodeClickTarget(AUTHOR_LINK);
    const signature = signClickTarget(TENANT_ID, AUTHOR_LINK);
    expect(verifiedClickTarget(OTHER_TENANT_ID, encoded, signature)).toBeNull();
  });

  it("refuses a swapped destination — the open-redirect attempt", () => {
    const signature = signClickTarget(TENANT_ID, AUTHOR_LINK);
    const attacker = encodeClickTarget("https://phishing.example/login");
    expect(verifiedClickTarget(TENANT_ID, attacker, signature)).toBeNull();
  });

  it("refuses a non-canonical encoding of a signed destination", () => {
    // base64 decoding is lenient about padding, so two different `u=` values
    // can decode to the same URL. Only the string that was signed is honoured.
    const signature = signClickTarget(TENANT_ID, AUTHOR_LINK);
    const padded = `${encodeClickTarget(AUTHOR_LINK)}=`;
    expect(verifiedClickTarget(TENANT_ID, padded, signature)).toBeNull();
  });

  it("refuses missing, empty or oversized parameters", () => {
    const signature = signClickTarget(TENANT_ID, AUTHOR_LINK);
    expect(verifiedClickTarget(TENANT_ID, null, signature)).toBeNull();
    expect(verifiedClickTarget(TENANT_ID, "", signature)).toBeNull();
    expect(
      verifiedClickTarget(TENANT_ID, encodeClickTarget(AUTHOR_LINK), null),
    ).toBeNull();
    expect(verifiedClickTarget(TENANT_ID, "A".repeat(4000), signature)).toBeNull();
    // The signature is bounded too: an unauthenticated query string must not
    // decide how much the server allocates before it can say no.
    expect(
      verifiedClickTarget(
        TENANT_ID,
        encodeClickTarget(AUTHOR_LINK),
        "x".repeat(5000),
      ),
    ).toBeNull();
  });
});

describe("plausibleClickTarget", () => {
  const SIGNATURE = signClickTarget(TENANT_ID, AUTHOR_LINK);

  it("answers without the key, so a route can refuse before spending anything", () => {
    expect(plausibleClickTarget(encodeClickTarget(AUTHOR_LINK), SIGNATURE)).toBe(
      AUTHOR_LINK,
    );
    // It says nothing about authenticity — any bounded signature shape passes.
    expect(plausibleClickTarget(encodeClickTarget(AUTHOR_LINK), "x")).toBe(
      AUTHOR_LINK,
    );
  });

  it("applies the same bounds the verified form does", () => {
    for (const [encoded, signature] of [
      [null, SIGNATURE],
      ["", SIGNATURE],
      [encodeClickTarget(AUTHOR_LINK), ""],
      [encodeClickTarget(AUTHOR_LINK), null],
      ["A".repeat(4000), SIGNATURE],
      [encodeClickTarget(AUTHOR_LINK), "x".repeat(5000)],
      [`${encodeClickTarget(AUTHOR_LINK)}=`, SIGNATURE],
    ] as const) {
      expect(plausibleClickTarget(encoded, signature)).toBeNull();
    }
  });
});

// ── Rewriting the document ──────────────────────────────────────────────────

describe("applyTrackingLinks", () => {
  it("points an author's inline link at the redirect", () => {
    const tracked = applyTrackingLinks(doc(linkedParagraph(AUTHOR_LINK)), CONTEXT);
    const href = (tracked.content?.[0].content?.[0].marks?.[0].attrs as {
      href: string;
    }).href;

    expect(href.startsWith(`${BASE_URL}${EMAIL_CLICK_TRACKING_PATH}?`)).toBe(true);
    expect(href).toContain(`u=${encodeClickTarget(AUTHOR_LINK)}`);
    expect(href).toContain(`s=${signClickTarget(TENANT_ID, AUTHOR_LINK)}`);
    expect(href).toContain(`t={{${TRACKING_TOKEN_VARIABLE}}}`);
  });

  it("points a button at the redirect too", () => {
    const tracked = applyTrackingLinks(
      doc({ type: "emailButton", attrs: { href: AUTHOR_LINK, label: "Shop" } }),
      CONTEXT,
    );
    const href = (tracked.content?.[0].attrs as { href: string }).href;
    expect(href).toContain(EMAIL_CLICK_TRACKING_PATH);
  });

  it("leaves mailto, tel and relative links exactly as written", () => {
    for (const href of ["mailto:hi@shop.example", "tel:+353871234567", "/x"]) {
      const tracked = applyTrackingLinks(doc(linkedParagraph(href)), CONTEXT);
      expect(
        (tracked.content?.[0].content?.[0].marks?.[0].attrs as { href: string })
          .href,
      ).toBe(href);
    }
  });

  it("leaves a destination too long for the route to honour alone", () => {
    // Better a working link with no statistic than a save the author cannot fix.
    const huge = `https://shop.example/?q=${"x".repeat(4000)}`;
    const tracked = applyTrackingLinks(doc(linkedParagraph(huge)), CONTEXT);
    expect(
      (tracked.content?.[0].content?.[0].marks?.[0].attrs as { href: string })
        .href,
    ).toBe(huge);
  });

  it("never mutates the document it was given", () => {
    const original = doc(linkedParagraph(AUTHOR_LINK));
    const snapshot = JSON.stringify(original);
    applyTrackingLinks(original, CONTEXT);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("reaches links nested inside lists", () => {
    const tracked = applyTrackingLinks(
      doc({
        type: "bulletList",
        content: [{ type: "listItem", content: [linkedParagraph(AUTHOR_LINK)] }],
      }),
      CONTEXT,
    );
    const href = (
      tracked.content?.[0].content?.[0].content?.[0].content?.[0].marks?.[0]
        .attrs as { href: string }
    ).href;
    expect(href).toContain(EMAIL_CLICK_TRACKING_PATH);
  });
});

describe("trackingPixelHtml", () => {
  it("survives the sanitizer unchanged in every part that matters", () => {
    // The sanitizer does not move for this feature — the pixel is written to
    // the allow-list, not the other way round.
    const sanitized = sanitizeEmailHtml(trackingPixelHtml(CONTEXT));
    expect(sanitized).toContain(`${BASE_URL}${EMAIL_OPEN_TRACKING_PATH}`);
    expect(sanitized).toContain(`{{${TRACKING_TOKEN_VARIABLE}}}`);
    expect(sanitized).toContain('width="1"');
    expect(sanitized).toContain('height="1"');
    expect(sanitized).toContain("display:block");
  });
});

// ── The save path ───────────────────────────────────────────────────────────

describe("the campaign save path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** `requireEmailShellTenant`'s one query. */
  function stubTenant(trackingEnabled: boolean) {
    const { id, businessName, subdomain, customDomain, settings, ...rest } =
      tenant(trackingEnabled);
    prismaMock.tenants.findFirst.mockResolvedValue({
      id,
      businessName,
      subdomain,
      customDomain,
      settings,
      ...rest,
      tenant_branding: null,
    });
  }

  it("stores NO tracking artifacts when the store has not turned it on", async () => {
    stubTenant(false);

    const { contentHtml } = await resolveCampaignContent(
      doc(linkedParagraph(AUTHOR_LINK)),
      TENANT_ID,
    );

    expect(contentHtml).not.toContain(EMAIL_OPEN_TRACKING_PATH);
    expect(contentHtml).not.toContain(EMAIL_CLICK_TRACKING_PATH);
    expect(contentHtml).not.toContain(TRACKING_TOKEN_VARIABLE);
    // The author's link is exactly what they wrote.
    expect(contentHtml).toContain(`href="${AUTHOR_LINK}"`);
  });

  it("wraps the links and adds the pixel once the store turns it on", async () => {
    stubTenant(true);

    const { contentHtml } = await resolveCampaignContent(
      doc(linkedParagraph(AUTHOR_LINK)),
      TENANT_ID,
    );

    expect(contentHtml).toContain(`${BASE_URL}${EMAIL_OPEN_TRACKING_PATH}`);
    expect(contentHtml).toContain(`${BASE_URL}${EMAIL_CLICK_TRACKING_PATH}`);
    expect(contentHtml).not.toContain(`href="${AUTHOR_LINK}"`);
  });

  it("never wraps the unsubscribe link", async () => {
    stubTenant(true);

    const { contentHtml } = await resolveCampaignContent(
      doc(linkedParagraph(AUTHOR_LINK)),
      TENANT_ID,
    );

    // US-017's tripwire looks for exactly this string, and a marketing email
    // whose opt-out depends on our redirect route resolving is not an opt-out.
    expect(contentHtml).toContain(`href="${UNSUBSCRIBE_URL_SLOT}"`);
  });
});

describe("the worker's compile step", () => {
  it("fills the token verbatim — no entity escaping", async () => {
    // The US-020 lesson: Handlebars escapes `=` to `&#x3D;`, which is why the
    // slot carries a TOKEN and not a whole URL. Proved by compiling the real
    // stored HTML with the same renderer scripts/email-worker.ts uses.
    const html = await renderEmailTemplateHtml({
      contentJson: doc(linkedParagraph(AUTHOR_LINK)),
      tenant: tenant(true),
      category: "marketing",
      tracking: { tenantId: TENANT_ID },
    });

    const token = signRecipientToken(RECIPIENT_ID);
    const rendered = renderEmailTemplate(html, {
      [TRACKING_TOKEN_VARIABLE]: token,
    });

    expect(rendered).toContain(`t=${token}`);
    expect(rendered).not.toContain(`{{${TRACKING_TOKEN_VARIABLE}}}`);
    expect(recipientIdFromToken(token)).toBe(RECIPIENT_ID);
  });

  it("produces a link the click route will actually verify", async () => {
    // The full round trip, because every step in it re-encodes something: the
    // destination is base64url'd, the sanitizer rewrites `&` to `&amp;` in the
    // attribute, and Handlebars fills the token. A URL that survives all three
    // and still verifies is the only proof the pieces agree.
    const destination = "https://shop.example/p/x?a=1&b=2";
    const html = await renderEmailTemplateHtml({
      contentJson: doc(linkedParagraph(destination)),
      tenant: tenant(true),
      category: "marketing",
      tracking: { tenantId: TENANT_ID },
    });

    const filled = renderEmailTemplate(html, {
      [TRACKING_TOKEN_VARIABLE]: signRecipientToken(RECIPIENT_ID),
    });

    const href = filled.match(
      new RegExp(`href="([^"]*${EMAIL_CLICK_TRACKING_PATH}[^"]*)"`),
    )?.[1];
    expect(href).toBeDefined();

    // What a browser hands the route: `&amp;` in an attribute is one `&`.
    const params = new URL(href!.replace(/&amp;/g, "&")).searchParams;
    expect(
      verifiedClickTarget(TENANT_ID, params.get("u"), params.get("s")),
    ).toBe(destination);
    expect(recipientIdFromToken(params.get("t"))).toBe(RECIPIENT_ID);
  });

  it("leaves an untracked body compiling to what it always did", async () => {
    const html = await renderEmailTemplateHtml({
      contentJson: doc(linkedParagraph(AUTHOR_LINK)),
      tenant: tenant(false),
      category: "marketing",
      tracking: { tenantId: TENANT_ID },
    });

    expect(renderEmailTemplate(html, {})).toContain(`href="${AUTHOR_LINK}"`);
  });

  it("never tracks a system template, which has no tenant or origin", async () => {
    const html = await renderEmailTemplateHtml({
      contentJson: doc(linkedParagraph(AUTHOR_LINK)),
      tenant: null,
      category: "marketing",
      tracking: { tenantId: TENANT_ID },
    });

    expect(html).not.toContain(EMAIL_OPEN_TRACKING_PATH);
  });
});

// ── The published privacy notice ────────────────────────────────────────────

describe("the tracking disclosure on the storefront privacy notice", () => {
  const TRACKING_HEADING = "Marketing emails and how we measure them";

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tenant_legal_profiles.findFirst.mockResolvedValue({
      controllerLegalName: "Healing Buds Ltd",
      registeredAddress: "12 Example Street, London EC1A 1AA",
      privacyContactEmail: "privacy@shop.example",
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    prismaMock.tenant_legal_documents.findFirst.mockResolvedValue({
      slug: "privacy",
      mode: "default",
      body: null,
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
      templateVersion: null,
    });
    // Unseeded platform table — the shipped template is the fallback, which is
    // the one this story edited.
    prismaMock.platform_legal_templates.findFirst.mockResolvedValue(null);
  });

  it("appears only for a store that has turned tracking on", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({ settings: TRACKING_ON });

    const document = await getTenantLegalDocument(TENANT_ID, "privacy");

    expect(document.status).toBe("published");
    expect(document.status === "published" && document.html).toContain(
      TRACKING_HEADING,
    );
  });

  it("is absent for a store that has not", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({ settings: {} });

    const document = await getTenantLegalDocument(TENANT_ID, "privacy");

    expect(document.status === "published" && document.html).not.toContain(
      TRACKING_HEADING,
    );
  });

  it("still publishes the notice when the settings read fails", async () => {
    // A privacy notice is legally required to be servable. Losing an optional
    // clause is a smaller wrong than a 500 on the page itself.
    prismaMock.tenants.findFirst.mockRejectedValue(new Error("connection lost"));

    const document = await getTenantLegalDocument(TENANT_ID, "privacy");

    expect(document.status).toBe("published");
    expect(document.status === "published" && document.html).not.toContain(
      TRACKING_HEADING,
    );
  });
});

// ── The fan-out ─────────────────────────────────────────────────────────────

describe("campaignRecipientVariables", () => {
  const base = {
    businessName: "Healing Buds",
    baseUrl: BASE_URL,
    subdomain: "healingbuds",
    email: "reader@example.com",
    unsubscribeUrl: `${BASE_URL}/unsub?token=abc`,
  };

  it("omits the token entirely when tracking is off", () => {
    // A payload from an untracked store is the object it was before US-027.
    expect(campaignRecipientVariables(base)).not.toHaveProperty(
      TRACKING_TOKEN_VARIABLE,
    );
    expect(
      campaignRecipientVariables({ ...base, trackingToken: null }),
    ).not.toHaveProperty(TRACKING_TOKEN_VARIABLE);
  });

  it("carries the signed token when tracking is on", () => {
    const token = signRecipientToken(RECIPIENT_ID);
    const variables = campaignRecipientVariables({
      ...base,
      trackingToken: token,
    });
    expect(variables[TRACKING_TOKEN_VARIABLE]).toBe(token);
    // And it is not the opt-out credential wearing another name.
    expect(variables[TRACKING_TOKEN_VARIABLE]).not.toBe(base.unsubscribeUrl);
  });
});
