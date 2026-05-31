import { describe, it, expect } from "vitest";
import {
  customDomainSlugForHost,
  customDomainRewritePath,
  normaliseCustomDomainHost,
  isCustomDomainSlug,
  LEGACY_CUSTOM_DOMAIN_SLUG,
  CUSTOM_DOMAIN_SLUG_PREFIX,
} from "@/lib/custom-domain-rewrite";

// PRD-212 — the red→green proof for custom-domain ISR cache isolation.
//
// Next.js keys its full-route (ISR) cache on the resolved PATHNAME. The bug was
// that middleware rewrote EVERY custom domain to the constant `/store/_cd/...`,
// collapsing all custom domains into one cache bucket so the second domain in a
// revalidate window got the first tenant's cached HTML.
//
// These assertions FAIL against the old constant-`_cd` derivation (it returns
// the same value for every host, and that value IS `_cd`) and PASS once the
// rewrite target is a function of the real host. This is the achievable local
// proof of AC-1 / AC-1a; the cross-render integration proof lives in
// tests/integration/custom-domain-isolation.integration.test.ts (BLOCKED on the
// PRD-207 Docker/Playwright harness).

// Storefront slug charset enforced at the API boundary (lib/validation/parse-uuid.ts
// SLUG_RE). The segment becomes params.slug for the cached render, so any value
// the cart/links read MUST satisfy this — `_cd` notably did NOT (leading "_").
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

const HOST_A = "tenant-a.com";
const HOST_B = "tenant-b.com";

describe("PRD-212 AC-1a — custom-domain cache key is host-scoped", () => {
  it("returns DISTINCT slugs for distinct hosts (no shared cache bucket)", () => {
    const a = customDomainSlugForHost(HOST_A);
    const b = customDomainSlugForHost(HOST_B);
    expect(a).not.toEqual(b);
  });

  it("returns a STABLE slug for the same host (AC-5: revalidation writes back to the same key)", () => {
    const first = customDomainSlugForHost(HOST_A);
    const second = customDomainSlugForHost(HOST_A);
    expect(first).toEqual(second);
  });

  it("is NEVER the shared `_cd` placeholder", () => {
    for (const host of [HOST_A, HOST_B, "example.com", "shop.example.co.uk", "a.io"]) {
      const slug = customDomainSlugForHost(host);
      expect(slug).not.toEqual(LEGACY_CUSTOM_DOMAIN_SLUG);
      expect(slug).not.toEqual("_cd");
    }
  });

  it("produces a segment that satisfies the storefront SLUG_RE (cart/links keep working)", () => {
    for (const host of [HOST_A, HOST_B, "EXAMPLE.com", "xn--80ak6aa92e.com", "a-b-c.example.org"]) {
      expect(customDomainSlugForHost(host)).toMatch(SLUG_RE);
    }
    // The legacy placeholder it replaces FAILS that charset — the latent bug the
    // host-scoped segment also fixes.
    expect("_cd").not.toMatch(SLUG_RE);
  });

  it("collapses case and trailing port to one bucket (one host = one tenant = one key)", () => {
    expect(customDomainSlugForHost("Example.com")).toEqual(customDomainSlugForHost("example.com"));
    expect(customDomainSlugForHost("example.com:443")).toEqual(customDomainSlugForHost("example.com"));
    expect(normaliseCustomDomainHost("  Example.COM:8080 ")).toEqual("example.com");
  });

  it("is well-distributed across many hosts (no accidental collisions in a representative set)", () => {
    const hosts = Array.from({ length: 500 }, (_, i) => `tenant-${i}.example.com`);
    const slugs = new Set(hosts.map(customDomainSlugForHost));
    expect(slugs.size).toEqual(hosts.length);
  });

  it("fails fast on an empty host rather than emit a degenerate shared key", () => {
    expect(() => customDomainSlugForHost("")).toThrow(RangeError);
    expect(() => customDomainSlugForHost("   ")).toThrow(RangeError);
  });
});

describe("PRD-212 — customDomainRewritePath", () => {
  it("builds a host-scoped /store/cd-<hash>/<path>, not the constant /store/_cd", () => {
    const path = customDomainRewritePath(HOST_A, "/products");
    expect(path.startsWith(`/store/${CUSTOM_DOMAIN_SLUG_PREFIX}`)).toBe(true);
    expect(path.endsWith("/products")).toBe(true);
    expect(path).not.toContain("/store/_cd");
  });

  it("gives two hosts two different rewrite targets for the same incoming path", () => {
    expect(customDomainRewritePath(HOST_A, "/")).not.toEqual(
      customDomainRewritePath(HOST_B, "/"),
    );
  });

  it("forwards the incoming pathname verbatim", () => {
    const slug = customDomainSlugForHost(HOST_A);
    expect(customDomainRewritePath(HOST_A, "/the-wire/some-post")).toEqual(
      `/store/${slug}/the-wire/some-post`,
    );
  });
});

describe("PRD-212 — isCustomDomainSlug", () => {
  it("recognises host-scoped segments and rejects real subdomains", () => {
    expect(isCustomDomainSlug(customDomainSlugForHost(HOST_A))).toBe(true);
    expect(isCustomDomainSlug("healingbuds")).toBe(false);
    expect(isCustomDomainSlug("_cd")).toBe(false);
  });
});
