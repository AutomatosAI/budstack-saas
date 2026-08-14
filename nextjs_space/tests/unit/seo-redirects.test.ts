import { describe, it, expect } from "vitest";

import {
  findRedirectChainProblem,
  isReservedRedirectPath,
  matchRedirect,
  normalizeRedirectPath,
  parseRedirectStatusCode,
  redirectMatchKey,
  SEO_REDIRECT_DEFAULT_STATUS,
  SEO_REDIRECT_MAX_PATH_LENGTH,
  type SeoRedirectRule,
} from "@/lib/seo/redirects";

/**
 * SEO Supercharge US-020 — the rules three separate callers depend on agreeing
 * about (the write routes, the public feed, and edge middleware). Everything
 * here is pure, so this file is the whole contract.
 */

const rule = (
  fromPath: string,
  toPath: string,
  statusCode = SEO_REDIRECT_DEFAULT_STATUS,
): SeoRedirectRule => ({ fromPath, toPath, statusCode });

describe("normalizeRedirectPath", () => {
  it("adds the leading slash and drops a trailing one", () => {
    expect(normalizeRedirectPath("products")).toBe("/products");
    expect(normalizeRedirectPath("/sale/")).toBe("/sale");
    expect(normalizeRedirectPath("/")).toBe("/");
  });

  it("preserves case — the destination is shown to a browser", () => {
    expect(normalizeRedirectPath("/The-Wire/My-Post")).toBe("/The-Wire/My-Post");
  });

  it("drops a query string and a fragment", () => {
    expect(normalizeRedirectPath("/sale?utm_source=x")).toBe("/sale");
    expect(normalizeRedirectPath("/sale#top")).toBe("/sale");
  });

  it("collapses repeated slashes, which is what defuses //evil.com", () => {
    // A protocol-relative URL: left alone, this redirects OFF the store.
    expect(normalizeRedirectPath("//evil.com/phish")).toBe("/evil.com/phish");
    expect(normalizeRedirectPath("/a//b///c")).toBe("/a/b/c");
  });

  it("refuses anything carrying a scheme", () => {
    expect(normalizeRedirectPath("https://evil.com")).toBeNull();
    expect(normalizeRedirectPath("javascript:alert(1)")).toBeNull();
    expect(normalizeRedirectPath("mailto:someone@example.com")).toBeNull();
  });

  it("refuses whitespace, control characters and traversal", () => {
    expect(normalizeRedirectPath("/two words")).toBeNull();
    expect(normalizeRedirectPath("/head\r\nInjected: yes")).toBeNull();
    expect(normalizeRedirectPath("/a/../../etc/passwd")).toBeNull();
  });

  it("refuses empties and over-long input", () => {
    expect(normalizeRedirectPath("")).toBeNull();
    expect(normalizeRedirectPath("   ")).toBeNull();
    expect(normalizeRedirectPath(undefined)).toBeNull();
    expect(normalizeRedirectPath(42)).toBeNull();
    expect(
      normalizeRedirectPath(`/${"x".repeat(SEO_REDIRECT_MAX_PATH_LENGTH)}`),
    ).toBeNull();
  });
});

describe("redirectMatchKey", () => {
  it("folds case so /Sale and /sale cannot be two rows", () => {
    expect(redirectMatchKey("/Sale/")).toBe("/sale");
    expect(redirectMatchKey("/sale")).toBe(redirectMatchKey("/SALE"));
  });
});

describe("isReservedRedirectPath", () => {
  it("refuses the platform's own surfaces", () => {
    for (const path of [
      "/api",
      "/api/store/x",
      "/tenant-admin",
      "/tenant-admin/seo",
      "/super-admin/tenants",
      "/_next/static",
      "/__clerk/handshake",
      "/sitemap.xml",
      "/robots.txt",
    ]) {
      expect(isReservedRedirectPath(path), path).toBe(true);
    }
  });

  it("allows ordinary store paths, including near-misses", () => {
    for (const path of [
      "/",
      "/products",
      "/api-guide",
      "/apilogy",
      "/tenant-admins-guide",
      "/sitemap",
      "/robots.txt.old",
    ]) {
      expect(isReservedRedirectPath(path), path).toBe(false);
    }
  });
});

describe("parseRedirectStatusCode", () => {
  it("accepts only the two permanent codes", () => {
    expect(parseRedirectStatusCode(301)).toBe(301);
    expect(parseRedirectStatusCode("308")).toBe(308);
    expect(parseRedirectStatusCode(302)).toBeNull();
    expect(parseRedirectStatusCode(200)).toBeNull();
    expect(parseRedirectStatusCode("nope")).toBeNull();
  });
});

describe("findRedirectChainProblem", () => {
  it("refuses a path redirecting to itself, case and slash included", () => {
    expect(
      findRedirectChainProblem([], { fromPath: "/a", toPath: "/a" }),
    ).toBe("self_redirect");
    expect(
      findRedirectChainProblem([], { fromPath: "/a", toPath: "/A/" }),
    ).toBe("self_redirect");
  });

  it("refuses the two-hop loop the story names (A->B->A)", () => {
    expect(
      findRedirectChainProblem([rule("/b", "/a")], {
        fromPath: "/a",
        toPath: "/b",
      }),
    ).toBe("loop");
  });

  it("refuses a longer cycle", () => {
    const existing = [rule("/b", "/c"), rule("/c", "/a")];
    expect(
      findRedirectChainProblem(existing, { fromPath: "/a", toPath: "/b" }),
    ).toBe("loop");
  });

  it("allows a legitimate chain that terminates", () => {
    const existing = [rule("/b", "/c")];
    expect(
      findRedirectChainProblem(existing, { fromPath: "/a", toPath: "/b" }),
    ).toBeNull();
  });

  it("ignores the row being replaced, so a retarget is not self-refused", () => {
    // /a -> /b already exists; retargeting it to /c must not read the old row
    // as the second half of a loop.
    const existing = [rule("/a", "/b")];
    expect(
      findRedirectChainProblem(existing, { fromPath: "/a", toPath: "/c" }),
    ).toBeNull();
  });
});

describe("matchRedirect", () => {
  const table = [rule("/old-page", "/new-page"), rule("/sale", "/", 308)];

  it("matches exactly, after normalising the incoming path", () => {
    expect(matchRedirect(table, "/old-page")?.toPath).toBe("/new-page");
    expect(matchRedirect(table, "/OLD-PAGE/")?.toPath).toBe("/new-page");
    expect(matchRedirect(table, "/old-page?ref=email")?.toPath).toBe(
      "/new-page",
    );
  });

  it("does NOT match by prefix — a rule claims one path, not a subtree", () => {
    expect(matchRedirect(table, "/old-page/child")).toBeNull();
    expect(matchRedirect(table, "/old")).toBeNull();
  });

  it("returns null for an unmatched or unusable path", () => {
    expect(matchRedirect(table, "/something-else")).toBeNull();
    expect(matchRedirect([], "/old-page")).toBeNull();
    expect(matchRedirect(table, "https://evil.com")).toBeNull();
  });

  it("carries the rule's own status code", () => {
    expect(matchRedirect(table, "/sale")?.statusCode).toBe(308);
  });
});
