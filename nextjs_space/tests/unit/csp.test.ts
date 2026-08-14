import { describe, expect, it } from "vitest";
import {
  applyCsp,
  buildCsp,
  generateNonce,
  variantForServedPath,
  type CspVariant,
} from "@/lib/security/csp";

const VARIANTS: CspVariant[] = ["base", "admin", "store"];
const NONCE = "TESTNONCEabc123==";

function directive(csp: string, name: string): string {
  return csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
}

describe("generateNonce", () => {
  it("returns a base64 string of at least 128 bits", () => {
    const n = generateNonce();
    expect(n).toMatch(/^[A-Za-z0-9+/]+=*$/);
    // 16 bytes -> 24 base64 chars (with padding)
    expect(n.length).toBeGreaterThanOrEqual(22);
  });

  it("is unique per call", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(seen.size).toBe(50);
  });

  it("never contains the chars Clerk/Next reject in a nonce", () => {
    // Clerk (app-router/server/utils) and Next reject a nonce containing
    // < > & or the U+2028 / U+2029 line separators: it would be dropped and the
    // page would fail to hydrate under strict-dynamic. base64 cannot produce
    // these, but guard against a future encoding change.
    const forbidden = ["<", ">", "&", String.fromCharCode(0x2028), String.fromCharCode(0x2029)];
    for (let i = 0; i < 100; i++) {
      const n = generateNonce();
      for (const ch of forbidden) {
        expect(n.includes(ch)).toBe(false);
      }
    }
  });
});

describe("buildCsp", () => {
  it.each(VARIANTS)(
    "variant %s: script-src carries the nonce + strict-dynamic and NO 'unsafe-inline'",
    (variant) => {
      const scriptSrc = directive(buildCsp({ nonce: NONCE, variant }), "script-src");
      expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
      expect(scriptSrc).toContain("'strict-dynamic'");
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    },
  );

  it("base/admin use frame-ancestors 'none'; store uses 'self'", () => {
    expect(buildCsp({ nonce: NONCE, variant: "base" })).toContain("frame-ancestors 'none'");
    expect(buildCsp({ nonce: NONCE, variant: "admin" })).toContain("frame-ancestors 'none'");
    expect(buildCsp({ nonce: NONCE, variant: "store" })).toContain("frame-ancestors 'self'");
  });

  it("admin adds 'unsafe-eval' for plotly; base/store do not", () => {
    expect(directive(buildCsp({ nonce: NONCE, variant: "admin" }), "script-src")).toContain(
      "'unsafe-eval'",
    );
    expect(directive(buildCsp({ nonce: NONCE, variant: "base" }), "script-src")).not.toContain(
      "'unsafe-eval'",
    );
    expect(directive(buildCsp({ nonce: NONCE, variant: "store" }), "script-src")).not.toContain(
      "'unsafe-eval'",
    );
  });

  it("every variant sets object-src 'none' and base-uri 'self'", () => {
    for (const variant of VARIANTS) {
      const csp = buildCsp({ nonce: NONCE, variant });
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
    }
  });

  it("keeps style-src 'unsafe-inline' (AC-2 scopes the change to script-src)", () => {
    expect(directive(buildCsp({ nonce: NONCE, variant: "base" }), "style-src")).toContain(
      "'unsafe-inline'",
    );
  });

  it("keeps the Clerk + Cloudflare host allowlist for CSP2 fallback", () => {
    const scriptSrc = directive(buildCsp({ nonce: NONCE, variant: "base" }), "script-src");
    expect(scriptSrc).toContain("https://*.clerk.accounts.dev");
    expect(scriptSrc).toContain("https://challenges.cloudflare.com");
  });

  it("SEO US-026: allows the GA4 hosts on the store variant only", () => {
    const store = buildCsp({ nonce: NONCE, variant: "store" });
    expect(directive(store, "script-src")).toContain(
      "https://www.googletagmanager.com",
    );
    // The two that 'strict-dynamic' does NOT cover, and without which the tag
    // loads but every hit is blocked.
    expect(directive(store, "connect-src")).toContain(
      "https://www.google-analytics.com",
    );
    expect(directive(store, "connect-src")).toContain(
      "https://*.google-analytics.com",
    );
    expect(directive(store, "img-src")).toContain(
      "https://www.google-analytics.com",
    );

    for (const variant of ["base", "admin"] as CspVariant[]) {
      const csp = buildCsp({ nonce: NONCE, variant });
      expect(csp).not.toContain("googletagmanager.com");
      expect(csp).not.toContain("google-analytics.com");
    }
  });

  it("SEO US-026: the GA4 hosts do not disturb the directives they were added to", () => {
    const store = buildCsp({ nonce: NONCE, variant: "store" });
    expect(directive(store, "connect-src")).toContain("'self'");
    expect(directive(store, "connect-src")).toContain(
      "https://*.clerk.accounts.dev",
    );
    expect(directive(store, "img-src")).toContain("'self'");
    expect(directive(store, "img-src")).toContain("https://*.amazonaws.com");
  });

  it("embeds a nonce token recoverable by the framework's 'nonce-...' parser", () => {
    // Next (app-render) + Clerk both extract the nonce by scanning script-src
    // for a 'nonce-XXX' token. Prove the policy we emit is parseable that way
    // and round-trips back to the exact nonce.
    const scriptSrc = directive(buildCsp({ nonce: NONCE, variant: "base" }), "script-src");
    const token = scriptSrc
      .split(" ")
      .find((s) => s.startsWith("'nonce-") && s.endsWith("'"));
    expect(token).toBeDefined();
    expect(token?.slice("'nonce-".length, -1)).toBe(NONCE);
  });
});

describe("variantForServedPath", () => {
  it("maps /store paths to the store variant", () => {
    expect(variantForServedPath("/store/acme")).toBe("store");
    expect(variantForServedPath("/store/_cd/products")).toBe("store");
  });

  it("maps the two analytics pages to the admin variant", () => {
    expect(variantForServedPath("/tenant-admin/analytics")).toBe("admin");
    expect(variantForServedPath("/super-admin/analytics")).toBe("admin");
  });

  it("maps everything else to base", () => {
    expect(variantForServedPath("/")).toBe("base");
    expect(variantForServedPath("/dashboard")).toBe("base");
    expect(variantForServedPath("/tenant-admin/settings")).toBe("base");
    expect(variantForServedPath("/api/foo")).toBe("base");
  });
});

describe("applyCsp", () => {
  it("sets exactly one Content-Security-Policy header carrying the nonce + variant policy", () => {
    const res = applyCsp(new Response(null), NONCE, "store");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).not.toBeNull();
    expect(csp).toContain(`'nonce-${NONCE}'`);
    expect(csp).toContain("frame-ancestors 'self'");
    // Headers can only hold one value for a given name - assert it equals the built policy.
    expect(csp).toBe(buildCsp({ nonce: NONCE, variant: "store" }));
  });

  it("returns the same response object it was given (mutates in place)", () => {
    const res = new Response(null);
    expect(applyCsp(res, NONCE, "base")).toBe(res);
  });

  it("emits the base policy (frame-ancestors 'none') for the base variant", () => {
    const res = applyCsp(new Response(null), NONCE, "base");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});
