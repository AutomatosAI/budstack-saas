import { describe, it, expect } from "vitest";

// PRD-203 US-002 — the auth-wrapper gate's classifier. Pure AST work (no fs,
// no DB), so the fixtures are inline source strings. These prove the OQ-4
// requirement: detection is AST-based, so import aliases, indirection and
// re-exports are followed — the cases a regex would miss.
import {
  classifySource,
  deriveApiPath,
  APPROVED_WRAPPERS,
} from "@/scripts/check-auth-wrappers.core";

function statusOf(src: string, apiPath: string, method = "GET") {
  const result = classifySource(apiPath, src);
  return result.handlers.find((h) => h.method === method);
}

describe("deriveApiPath", () => {
  it("maps a file path to its /api path, preserving [param] segments", () => {
    expect(deriveApiPath("app/api/store/[slug]/products/route.ts")).toBe(
      "/api/store/[slug]/products",
    );
    expect(deriveApiPath("app/api/health/route.ts")).toBe("/api/health");
  });

  it("works from an absolute path too", () => {
    expect(
      deriveApiPath("/Users/x/nextjs_space/app/api/tenant/current/route.ts"),
    ).toBe("/api/tenant/current");
  });
});

describe("classifySource — the wrapped / allow-listed / violation matrix", () => {
  it("flags a bare exported function handler as a VIOLATION", () => {
    const src = `export async function GET() { return new Response("ok"); }`;
    const result = classifySource("/api/tenant-admin/analytics", src);
    expect(statusOf(src, "/api/tenant-admin/analytics")?.status).toBe("violation");
    expect(result.violations).toContain("GET");
  });

  it("passes a route wrapped in an approved wrapper", () => {
    const src = `import { withTenantAuth } from "@/lib/api-auth";
export const GET = withTenantAuth(async (req, { tenantId }) => new Response(tenantId));`;
    const handler = statusOf(src, "/api/tenant-admin/analytics");
    expect(handler?.status).toBe("wrapped");
    expect(handler?.wrapper).toBe("withTenantAuth");
    expect(classifySource("/api/tenant-admin/analytics", src).violations).toHaveLength(0);
  });

  it("passes a bare handler when the route is on the public allow-list", () => {
    const src = `export async function GET() { return Response.json({ ok: true }); }`;
    const result = classifySource("/api/health", src);
    expect(result.allowListed).toBe(true);
    expect(statusOf(src, "/api/health")?.status).toBe("allow-listed");
    expect(result.violations).toHaveLength(0);
  });
});

describe("classifySource — OQ-4 AST robustness (aliases, indirection, re-exports)", () => {
  it("follows an ALIASED wrapper import (withAuth as guard)", () => {
    const src = `import { withAuth as guard } from "@/lib/api-auth";
export const POST = guard(async (req) => new Response("x"));`;
    const handler = statusOf(src, "/api/orders", "POST");
    expect(handler?.status).toBe("wrapped");
    expect(handler?.wrapper).toBe("withAuth");
  });

  it("follows a re-export of an indirectly-wrapped const", () => {
    const src = `import { withSuperAdmin } from "@/lib/api-auth";
const handler = withSuperAdmin(async () => new Response("x"));
export { handler as GET };`;
    expect(statusOf(src, "/api/super-admin/settings")?.status).toBe("wrapped");
  });

  it("classifies each method of a multi-method route independently", () => {
    const src = `import { withTenantAuth } from "@/lib/api-auth";
export const GET = withTenantAuth(async () => new Response("x"));
export async function POST() { return new Response("y"); }`;
    const result = classifySource("/api/tenant-admin/orders", src);
    expect(result.handlers.find((h) => h.method === "GET")?.status).toBe("wrapped");
    expect(result.handlers.find((h) => h.method === "POST")?.status).toBe("violation");
    expect(result.violations).toEqual(["POST"]);
  });

  it("does not treat a non-handler export as a handler", () => {
    const src = `export const runtime = "nodejs";
import { withAuth } from "@/lib/api-auth";
export const GET = withAuth(async () => new Response("x"));`;
    const result = classifySource("/api/orders", src);
    expect(result.handlers).toHaveLength(1);
    expect(result.handlers[0]?.method).toBe("GET");
  });
});

describe("APPROVED_WRAPPERS", () => {
  it("is exactly the five api-auth wrappers PRD-203 rolls out", () => {
    expect([...APPROVED_WRAPPERS]).toEqual([
      "withTenantAuth",
      "withTenantAuthParams",
      "withSuperAdmin",
      "withSuperAdminParams",
      "withAuth",
    ]);
  });
});
