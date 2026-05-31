import { describe, it, expect } from "vitest";
import { parseHostToTenantHint } from "@/lib/parse-host";

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

  it("returns null for www.<base> and any www.* host", () => {
    expect(parseHostToTenantHint("www.budstacks.io", BASE)).toBeNull();
    expect(parseHostToTenantHint("www.example.com", BASE)).toBeNull();
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
