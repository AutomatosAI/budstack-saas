import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Email Phase 2 US-005 — the response contract of the public image route.
//
// Module-boundary mocks only: the aws-config accessors are stubbed so no
// network, bucket or credentials are needed. The key parser and the
// s3-tenant-guard run REAL, so what these assert is the real access decision.
vi.mock("@/lib/storage/aws-config", () => ({
  getBucketConfig: vi.fn(),
  createS3Client: vi.fn(),
}));

import { createS3Client, getBucketConfig } from "@/lib/storage/aws-config";
import { GET } from "@/app/api/public/images/[...key]/route";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";

const PIXEL = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const KEY = "development/tenants/tenant-a/uploads/1754000000000-cover.png";

let send: ReturnType<typeof vi.fn>;

function objectBody() {
  return {
    transformToWebStream: () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(PIXEL);
          controller.close();
        },
      }),
  };
}

/** Request the route as a browser would — the path stays percent-encoded. */
function get(keyPath: string): Promise<Response> {
  const encoded = keyPath.split("/").map(encodeURIComponent).join("/");
  return GET(
    new NextRequest(
      `https://healingbuds.budstacks.io${PUBLIC_IMAGE_ROUTE_PREFIX}${encoded}`,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  send = vi.fn().mockResolvedValue({ ContentType: "image/png", Body: objectBody() });
  vi.mocked(createS3Client).mockResolvedValue({ send } as never);
  vi.mocked(getBucketConfig).mockResolvedValue({
    bucketName: "budstack-uploads",
    folderPrefix: "development/",
    region: "eu-west-2",
  });
});

describe("GET /api/public/images/[...key] — serving an upload", () => {
  it("streams the object with an immutable cache header and the right type", async () => {
    const response = await get(KEY);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PIXEL);
  });

  it("asks S3 for exactly the key in the URL, bucket prefix included", async () => {
    await get(KEY);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "budstack-uploads",
      Key: KEY,
    });
  });

  it("serves the extension's type, not the one S3 has stored", async () => {
    // An object mislabelled at upload time must not dictate how we hand it
    // back — otherwise the allow-list is decided by whoever wrote the object.
    send.mockResolvedValue({ ContentType: "image/jpeg", Body: objectBody() });

    const response = await get(KEY);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });
});

describe("GET /api/public/images/[...key] — what it refuses", () => {
  it("404s a key outside tenants/{id}/uploads/ without touching S3", async () => {
    const response = await get("development/templates/healingbudsv2/logo.png");

    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("404s a non-image extension without touching S3", async () => {
    const response = await get("development/tenants/tenant-a/uploads/1-logo.svg");

    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("404s an unknown key and does not leak the S3 error", async () => {
    send.mockRejectedValue(
      new Error("NoSuchKey: The specified key does not exist in budstack-uploads"),
    );

    const response = await get(KEY);
    const body = await response.json();

    // The client-facing message is fixed and carries a correlation id instead —
    // the S3 text (and the bucket name in it) stays in the server log. apiError
    // additionally attaches `details` OUTSIDE production; that dev-only escape
    // hatch is its existing, reviewed behaviour and is not asserted here.
    expect(response.status).toBe(404);
    expect(body.error).toBe("Image not found");
    expect(body.error).not.toContain("budstack-uploads");
    expect(body.correlationId).toBeTruthy();
  });

  it("404s an object S3 says is not an image", async () => {
    send.mockResolvedValue({ ContentType: "text/html", Body: objectBody() });

    const response = await get(KEY);

    expect(response.status).toBe(404);
  });

  it("answers a missing key and a denied key identically", async () => {
    send.mockRejectedValue(new Error("AccessDenied"));
    const denied = await get(KEY);
    send.mockRejectedValue(new Error("NoSuchKey"));
    const missing = await get(KEY);

    expect(denied.status).toBe(missing.status);
    expect((await denied.json()).error).toBe((await missing.json()).error);
  });
});
