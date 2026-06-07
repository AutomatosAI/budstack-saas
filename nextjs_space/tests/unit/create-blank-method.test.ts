import { describe, it, expect, vi } from "vitest";

// PRD-203 follow-up (PR #115 review) — the super-admin "create blank template"
// route creates a DB row AND writes S3 objects, so it must be a non-idempotent
// POST, never a GET that a browser prefetch or crawler could fire. This pins the
// HTTP-method contract; the S3 + DB deps are stubbed so importing the module
// touches no AWS and instantiates no client.
vi.mock("@/lib/db", () => ({ prisma: { templates: { create: vi.fn() } } }));
vi.mock("@/lib/storage/aws-config", () => ({
  createS3Client: vi.fn(),
  getBucketConfig: vi.fn(),
}));
vi.mock("@aws-sdk/client-s3", () => ({ PutObjectCommand: vi.fn() }));

import * as createBlankRoute from "@/app/api/super-admin/templates/create-blank/route";

describe("super-admin/templates/create-blank — POST not GET (finding #8)", () => {
  it("exports a POST handler", () => {
    expect(typeof createBlankRoute.POST).toBe("function");
  });

  it("does not export a GET handler (prefetch/crawl can't trigger it)", () => {
    expect(
      (createBlankRoute as Record<string, unknown>).GET,
    ).toBeUndefined();
  });
});
