import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce, type CspVariant } from "@/lib/security/csp";

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
});
