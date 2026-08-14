import { describe, it, expect } from "vitest";
import { parseHostToTenantHint, wwwRedirectHost } from "@/lib/parse-host";

// PRD-205 US-001 (AC-2a) — the one host→tenant-hint mapping that middleware.ts
// and lib/tenant-resolver.ts both consume. Pure function, node-only.
const BASE = "budstacks.io";

describe("PRD-205 AC-2a — parseHostToTenantHint", () => {
  it("maps slug.<base> to a subdomain hint", () => {
    expect(parseHostToTenantHint("acme.budstacks.io", BASE)).toEqual({
      kind: "subdomain",
      subdomain: "acme",
    });
  });

  it("strips a trailing :port before mapping", () => {
    expect(parseHostToTenantHint("acme.budstacks.io:3000", BASE)).toEqual({
      kind: "subdomain",
      subdomain: "acme",
    });
  });

  it("maps a custom domain (apex and sub) to a customDomain hint", () => {
    expect(parseHostToTenantHint("shop.example.com", BASE)).toEqual({
      kind: "customDomain",
      host: "shop.example.com",
    });
    expect(parseHostToTenantHint("example.com", BASE)).toEqual({
      kind: "customDomain",
      host: "example.com",
    });
  });

  // SEO US-008 — this used to assert the black hole (every www.* host → null,
  // i.e. served the BudStacks platform page). www is now the apex under another
  // name: middleware 301s it away, and the hint matches the redirect target so
  // any caller that still sees a www host resolves the same tenant.
  it("SEO US-008 — maps a www host to the hint of its apex", () => {
    expect(parseHostToTenantHint("www.example.com", BASE)).toEqual({
      kind: "customDomain",
      host: "example.com",
    });
    expect(parseHostToTenantHint("www.acme.budstacks.io", BASE)).toEqual({
      kind: "subdomain",
      subdomain: "acme",
    });
    // `www` is a RESERVED_SUBDOMAIN, so www.<base> can only mean the platform.
    expect(parseHostToTenantHint("www.budstacks.io", BASE)).toBeNull();
    // Degenerate www hosts have no routable apex — still no tenant.
    expect(parseHostToTenantHint("www.", BASE)).toBeNull();
    expect(parseHostToTenantHint("www.localhost:3000", BASE)).toBeNull();
  });

  it("returns null for the base domain itself", () => {
    expect(parseHostToTenantHint("budstacks.io", BASE)).toBeNull();
  });

  it("returns null for localhost / 127.0.0.1 (with or without port)", () => {
    expect(parseHostToTenantHint("localhost", BASE)).toBeNull();
    expect(parseHostToTenantHint("localhost:3000", BASE)).toBeNull();
    expect(parseHostToTenantHint("127.0.0.1:3000", BASE)).toBeNull();
  });

  it("returns null for empty / missing host", () => {
    expect(parseHostToTenantHint("", BASE)).toBeNull();
    expect(parseHostToTenantHint(null, BASE)).toBeNull();
    expect(parseHostToTenantHint(undefined, BASE)).toBeNull();
  });

  it("honours a custom base-domain argument", () => {
    expect(parseHostToTenantHint("acme.budstacks.dev", "budstacks.dev")).toEqual({
      kind: "subdomain",
      subdomain: "acme",
    });
    // under a different base, the .io host is just a custom domain
    expect(parseHostToTenantHint("acme.budstacks.io", "budstacks.dev")).toEqual({
      kind: "customDomain",
      host: "acme.budstacks.io",
    });
  });

  it("keeps a multi-label left part as the full subdomain", () => {
    expect(parseHostToTenantHint("preview.acme.budstacks.io", BASE)).toEqual({
      kind: "subdomain",
      subdomain: "preview.acme",
    });
  });
});

// SEO US-008 — the www redirect contract middleware.ts enforces before tenant
// resolution. A non-null return means "301 the request to this host"; null
// means "not a www request, carry on".
describe("SEO US-008 — wwwRedirectHost", () => {
  it("strips www from a custom domain (apex and sub)", () => {
    expect(wwwRedirectHost("www.example.com")).toBe("example.com");
    expect(wwwRedirectHost("www.shop.example.com")).toBe("shop.example.com");
    expect(wwwRedirectHost("www.healingbuds.co.za")).toBe("healingbuds.co.za");
  });

  it("strips www from a tenant subdomain and from the platform apex", () => {
    expect(wwwRedirectHost("www.acme.budstacks.io")).toBe("acme.budstacks.io");
    expect(wwwRedirectHost("www.budstacks.io")).toBe("budstacks.io");
  });

  it("strips a trailing :port before mapping", () => {
    expect(wwwRedirectHost("www.example.com:3000")).toBe("example.com");
  });

  it("matches the www prefix case-insensitively and returns the host as sent", () => {
    expect(wwwRedirectHost("WWW.example.com")).toBe("example.com");
  });

  it("returns null for a non-www host (nothing to redirect)", () => {
    expect(wwwRedirectHost("example.com")).toBeNull();
    expect(wwwRedirectHost("acme.budstacks.io")).toBeNull();
    expect(wwwRedirectHost("budstacks.io")).toBeNull();
    // A label that merely starts with "www" is not a www host.
    expect(wwwRedirectHost("wwwshop.example.com")).toBeNull();
  });

  it("returns null in local dev — no https redirect off localhost", () => {
    expect(wwwRedirectHost("www.localhost")).toBeNull();
    expect(wwwRedirectHost("www.localhost:3000")).toBeNull();
    expect(wwwRedirectHost("www.127.0.0.1:3000")).toBeNull();
  });

  it("returns null when there is no routable apex left", () => {
    expect(wwwRedirectHost("www.")).toBeNull();
    expect(wwwRedirectHost("www.local")).toBeNull();
  });

  it("returns null for empty / missing host", () => {
    expect(wwwRedirectHost("")).toBeNull();
    expect(wwwRedirectHost(null)).toBeNull();
    expect(wwwRedirectHost(undefined)).toBeNull();
  });
});
