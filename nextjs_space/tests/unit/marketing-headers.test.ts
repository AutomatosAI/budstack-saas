import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

// Email Phase 2 US-020 — compliance headers + the enforced footer.
//
// The worker cannot be imported (it constructs a BullMQ Worker and a Redis
// connection at module load), so the decision it makes lives in
// `resolveMarketingCompliance` and is asserted here — against output from the
// REAL US-011 pipeline compiled by the REAL worker-side Handlebars step, not
// against a hand-written approximation of either.
//
// Three properties carry the story:
//
//   1. A genuine campaign PASSES. Handlebars escapes `=` to `&#x3D;`, so the
//      rendered body does NOT contain the unsubscribe URL verbatim — a naive
//      `includes(url)` guard would refuse every correct marketing send.
//   2. A body with no rendered footer is REFUSED, and refused with the
//      machine-matchable `missing-footer` reason.
//   3. Transactional is untouched — no guard, no headers, no change.

import { campaignRecipientVariables } from "@/lib/email/campaign-send";
import {
  parseEmailContentJson,
  type EmailContentJson,
} from "@/lib/email/email-content-json";
import { renderEmailTemplateHtml } from "@/lib/email/email-render-pipeline";
import {
  UNSUBSCRIBE_URL_SLOT,
  type EmailShellTenant,
} from "@/lib/email/email-shell";
import { renderEmailTemplate } from "@/lib/email/handlebars-helpers";
import {
  LIST_UNSUBSCRIBE_POST_VALUE,
  MISSING_FOOTER_LOG_MESSAGE,
  MISSING_FOOTER_REASON,
  headerSafeUnsubscribeUrl,
  htmlCarriesUnsubscribeUrl,
  listUnsubscribeHeaders,
  resolveMarketingCompliance,
  unsubscribeMailto,
} from "@/lib/email/marketing-headers";
import { buildNewsletterUnsubscribeUrl } from "@/lib/email/newsletter-unsubscribe";

/** A custom domain, so nothing here depends on NEXT_PUBLIC_BASE_DOMAIN. */
const TENANT: EmailShellTenant = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  businessAddress1: "1 Sample Street",
  businessCity: "Dublin",
};

/** base64url, exactly what `generateSubscriberToken()` mints. */
const TOKEN = "Zm9vYmFy_qux-123"; // gitleaks:allow — test fixture, not a credential
const UNSUBSCRIBE_URL = buildNewsletterUnsubscribeUrl(TENANT, TOKEN);
const RECIPIENT = "jane@example.com";

const VARIABLES = campaignRecipientVariables({
  businessName: TENANT.businessName,
  baseUrl: "https://shop.example",
  subdomain: TENANT.subdomain,
  email: RECIPIENT,
  name: "Jane",
  unsubscribeUrl: UNSUBSCRIBE_URL,
});

function doc(...content: unknown[]): EmailContentJson {
  return parseEmailContentJson({ type: "doc", content });
}

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

/** The stored `contentHtml` a campaign save produces, for a given category. */
function renderStored(category?: "marketing"): Promise<string> {
  return renderEmailTemplateHtml({
    contentJson: doc(paragraph("Two for one this weekend.")),
    tenant: TENANT,
    category,
  });
}

describe("the escaping is the whole difficulty", () => {
  it("passes a real campaign body through the real pipeline and compile", async () => {
    const stored = await renderStored("marketing");

    // What US-017 already asserts about the SAVED column: the slot, in an href.
    expect(stored).toContain(`href="${UNSUBSCRIBE_URL_SLOT}"`);

    const sent = renderEmailTemplate(stored, VARIABLES);

    // THE POINT. Handlebars maps `=` to `&#x3D;`, so the URL the header will
    // carry is nowhere in the body verbatim — a guard written as
    // `html.includes(url)` would refuse this, and every other correct campaign.
    expect(sent).not.toContain(UNSUBSCRIBE_URL);
    expect(sent).toContain(Handlebars.escapeExpression(UNSUBSCRIBE_URL));

    expect(htmlCarriesUnsubscribeUrl(sent, UNSUBSCRIBE_URL)).toBe(true);
    expect(
      resolveMarketingCompliance({
        category: "marketing",
        variables: VARIABLES,
        html: sent,
      }),
    ).toEqual({ refuse: false, unsubscribeUrl: UNSUBSCRIBE_URL });
  });

  it("accepts a body that carries the URL unescaped", () => {
    const sent = renderEmailTemplate(
      `<a href="{{{unsubscribeUrl}}}">Unsubscribe</a>`,
      VARIABLES,
    );

    expect(sent).toContain(UNSUBSCRIBE_URL);
    expect(htmlCarriesUnsubscribeUrl(sent, UNSUBSCRIBE_URL)).toBe(true);
  });

  it("refuses a body where the slot was never filled", () => {
    expect(
      htmlCarriesUnsubscribeUrl(
        `<a href="${UNSUBSCRIBE_URL_SLOT}">Unsubscribe</a>`,
        UNSUBSCRIBE_URL,
      ),
    ).toBe(false);
  });

  it("refuses when there is no URL to look for", () => {
    expect(htmlCarriesUnsubscribeUrl("<p>anything</p>", null)).toBe(false);
    expect(htmlCarriesUnsubscribeUrl("<p>anything</p>", "")).toBe(false);
  });
});

describe("the footer is enforced on the rendered body", () => {
  it("refuses marketing rendered without the shell's unsubscribe line", async () => {
    // The same document saved WITHOUT the marketing category: the shell emits
    // no footer link, and sending it as marketing anyway is the regression this
    // guard exists to catch.
    const stored = await renderStored();
    expect(stored).not.toContain(UNSUBSCRIBE_URL_SLOT);

    expect(
      resolveMarketingCompliance({
        category: "marketing",
        variables: VARIABLES,
        html: renderEmailTemplate(stored, VARIABLES),
      }),
    ).toEqual({ refuse: true, unsubscribeUrl: null });
  });

  it("refuses marketing whose payload carries no unsubscribe URL", async () => {
    const sent = renderEmailTemplate(await renderStored("marketing"), {});

    expect(
      resolveMarketingCompliance({
        category: "marketing",
        variables: {},
        html: sent,
      }),
    ).toEqual({ refuse: true, unsubscribeUrl: null });
  });

  it("names a reason the results page can match on", () => {
    expect(MISSING_FOOTER_REASON).toBe("missing-footer");
    expect(MISSING_FOOTER_LOG_MESSAGE.startsWith(`${MISSING_FOOTER_REASON}:`)).toBe(
      true,
    );
  });
});

describe("transactional is completely unaffected", () => {
  // A body with no unsubscribe link anywhere — an order confirmation.
  const RECEIPT = "<html><body><p>Your order shipped.</p></body></html>";

  it.each([
    ["transactional", "transactional"],
    ["absent (pre-US-004 payload)", undefined],
    ["null", null],
    ["the wrong case", "MARKETING"],
    ["a value nobody defined", "promo"],
    ["a number", 42],
  ])("does not guard or decorate a %s job", (_label, category) => {
    expect(
      resolveMarketingCompliance({
        category,
        variables: VARIABLES,
        html: RECEIPT,
      }),
    ).toEqual({ refuse: false, unsubscribeUrl: null });
  });

  it("never offers a header for a transactional job even with a valid URL", () => {
    const { unsubscribeUrl } = resolveMarketingCompliance({
      category: "transactional",
      variables: VARIABLES,
      html: `<a href="${UNSUBSCRIBE_URL}">x</a>`,
    });

    // Null is what makes the worker's conditional spread omit `headers`
    // entirely, so the sendMail payload is the object it was before US-020.
    expect(unsubscribeUrl).toBeNull();
  });
});

describe("headerSafeUnsubscribeUrl", () => {
  it("takes an absolute https link out of the variables bag", () => {
    expect(headerSafeUnsubscribeUrl(VARIABLES)).toBe(UNSUBSCRIBE_URL);
    expect(headerSafeUnsubscribeUrl({ unsubscribeUrl: ` ${UNSUBSCRIBE_URL} ` })).toBe(
      UNSUBSCRIBE_URL,
    );
  });

  it.each([
    ["a missing bag", undefined],
    ["null", null],
    ["a string", "unsubscribeUrl"],
    ["an empty bag", {}],
    ["a non-string value", { unsubscribeUrl: 12 }],
    ["an empty value", { unsubscribeUrl: "   " }],
    ["a relative path", { unsubscribeUrl: "/api/storefront/newsletter/unsubscribe" }],
    ["the unfilled slot", { unsubscribeUrl: UNSUBSCRIBE_URL_SLOT }],
    ["a javascript: URL", { unsubscribeUrl: "javascript:alert(1)" }],
  ])("rejects %s", (_label, variables) => {
    expect(headerSafeUnsubscribeUrl(variables)).toBeNull();
  });

  it("rejects a URL that would inject a second header", () => {
    // The URL is built from the tenant's own customDomain, so it is
    // tenant-controlled data on its way into a mail header. Fail closed: no
    // URL means the send is refused, not sent with a smuggled Bcc.
    const injected = `https://shop.example\r\nBcc: attacker@evil.test`;
    expect(headerSafeUnsubscribeUrl({ unsubscribeUrl: injected })).toBeNull();
    expect(
      resolveMarketingCompliance({
        category: "marketing",
        variables: { unsubscribeUrl: injected },
        html: `<a href="${injected}">x</a>`,
      }),
    ).toEqual({ refuse: true, unsubscribeUrl: null });
  });

  it("rejects a URL carrying the header's own framing characters", () => {
    expect(
      headerSafeUnsubscribeUrl({ unsubscribeUrl: "https://shop.example/?a=<b>" }),
    ).toBeNull();
  });

  it.each([
    ["a NEL, which JS's \\s does not cover", "\u0085"],
    ["a line separator", "\u2028"],
    ["a paragraph separator", "\u2029"],
    ["a null byte", "\u0000"],
    ["a vertical tab", "\v"],
    ["a raw CRLF", "\r\n"],
  ])("rejects %s — the allow-list enumerates nothing", (_label, char) => {
    expect(
      headerSafeUnsubscribeUrl({
        unsubscribeUrl: `https://shop.example/x${char}y`,
      }),
    ).toBeNull();
  });

  it("still accepts every character a real unsubscribe URL uses", () => {
    // Guards the allow-list from being tightened past the URLs it must pass.
    expect(headerSafeUnsubscribeUrl(VARIABLES)).toBe(UNSUBSCRIBE_URL);
    expect(
      headerSafeUnsubscribeUrl({
        unsubscribeUrl: "https://shop.example:8443/a~b/c.d?e=f&g=h%20i#j",
      }),
    ).toBe("https://shop.example:8443/a~b/c.d?e=f&g=h%20i#j");
  });
});

describe("a non-string body is refused, not thrown on", () => {
  // `html` is typed, but it arrives from an untyped queue payload. Throwing
  // here would escape the worker's try/catch and leave the row QUEUED through
  // three silent retries instead of FAILED once.
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 42],
    ["an object", {}],
  ])("refuses a marketing job whose html is %s", (_label, html) => {
    expect(() =>
      resolveMarketingCompliance({
        category: "marketing",
        variables: VARIABLES,
        html: html as never,
      }),
    ).not.toThrow();

    expect(
      resolveMarketingCompliance({
        category: "marketing",
        variables: VARIABLES,
        html: html as never,
      }),
    ).toEqual({ refuse: true, unsubscribeUrl: null });
  });

  it("leaves a transactional job with a non-string body alone", () => {
    expect(
      resolveMarketingCompliance({
        category: "transactional",
        variables: VARIABLES,
        html: undefined as never,
      }),
    ).toEqual({ refuse: false, unsubscribeUrl: null });
  });
});

describe("unsubscribeMailto", () => {
  it.each([
    ["a bare address", "orders@shop.example"],
    ["a display name", '"Healing Buds" <orders@shop.example>'],
    ["an unquoted display name", "Healing Buds <orders@shop.example>"],
  ])("pulls the mailbox out of %s", (_label, from) => {
    expect(unsubscribeMailto(from)).toBe(
      "mailto:orders@shop.example?subject=Unsubscribe",
    );
  });

  it.each([
    ["a missing from", undefined],
    ["a non-string", 42],
    ["a display name with no address", "Healing Buds"],
    ["an empty string", ""],
  ])("returns null for %s", (_label, from) => {
    expect(unsubscribeMailto(from)).toBeNull();
  });

  // `tenants.settings.smtp.fromEmail` is what lands here, and any tenant admin
  // can set it to any string — it is stored behind `z.string().max(320)` with
  // no format check. Splicing that into `mailto:${address}?subject=…` unchecked
  // would let a tenant append their own query fields to a URI every recipient's
  // mail client is invited to act on.
  it.each([
    ["a smuggled cc field", "orders@shop.example?cc=harvest@attacker.test"],
    ["a smuggled body field", "orders@shop.example&body=leak"],
    ["a percent escape", "orders%40shop.example@shop.example"],
    ["a fragment", "orders@shop.example#x"],
    ["a path", "orders@shop.example/../x"],
    ["two mailboxes", "a@b@shop.example"],
  ])("refuses to build a mailto from %s", (_label, from) => {
    expect(unsubscribeMailto(from)).toBeNull();
  });

  it("drops only the mailto half — the one-click target is untouched", () => {
    // Being strict about the address costs the header nothing that Gmail or
    // Yahoo require, and refuses nothing: the send still goes out.
    const headers = listUnsubscribeHeaders(
      UNSUBSCRIBE_URL,
      "orders@shop.example?cc=harvest@attacker.test",
    );

    expect(headers["List-Unsubscribe"]).toBe(`<${UNSUBSCRIBE_URL}>`);
    expect(headers["List-Unsubscribe"]).not.toContain("attacker.test");
    expect(headers["List-Unsubscribe-Post"]).toBe(LIST_UNSUBSCRIBE_POST_VALUE);
  });

  it("takes the first mailbox of a comma-joined From and drops the rest", () => {
    // A second address cannot ride along into the header: `recipientAddresses`
    // splits on the comma nodemailer would have treated as a separator, and
    // only the first mailbox is ever spliced into the mailto.
    const mailto = unsubscribeMailto(
      "orders@shop.example,victim@elsewhere.test",
    );

    expect(mailto).toBe("mailto:orders@shop.example?subject=Unsubscribe");
    expect(mailto).not.toContain("elsewhere.test");
  });

  it("still accepts the mailbox shapes a real store uses", () => {
    expect(unsubscribeMailto("orders+news@shop.example")).toBe(
      "mailto:orders+news@shop.example?subject=Unsubscribe",
    );
    expect(unsubscribeMailto("no-reply.store@mail.shop.example")).toBe(
      "mailto:no-reply.store@mail.shop.example?subject=Unsubscribe",
    );
  });
});

describe("listUnsubscribeHeaders", () => {
  it("carries mailto then https, and the one-click post directive", () => {
    expect(
      listUnsubscribeHeaders(UNSUBSCRIBE_URL, '"Healing Buds" <orders@shop.example>'),
    ).toEqual({
      "List-Unsubscribe": `<mailto:orders@shop.example?subject=Unsubscribe>, <${UNSUBSCRIBE_URL}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("ships https-only rather than inventing a mailbox that would bounce", () => {
    expect(listUnsubscribeHeaders(UNSUBSCRIBE_URL, undefined)).toEqual({
      "List-Unsubscribe": `<${UNSUBSCRIBE_URL}>`,
      "List-Unsubscribe-Post": LIST_UNSUBSCRIBE_POST_VALUE,
    });
  });

  it("points one-click at the route that answers a headerless POST", () => {
    const { "List-Unsubscribe": header } = listUnsubscribeHeaders(
      UNSUBSCRIBE_URL,
      "orders@shop.example",
    );

    // US-004's route: GET renders the confirmation page, POST does the work
    // with no session and no CSRF token, which is what makes it a legal
    // RFC 8058 target.
    expect(header).toContain("/api/storefront/newsletter/unsubscribe?token=");
  });
});
