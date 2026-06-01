import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// PRD-206 US-010 — scope behaviour of getFileUrl + uploadFile.
//
// Module-boundary mocks only (allowed): we stub the aws-config accessors and
// the presigner so no network/AWS/credentials are needed. The tenant-scope
// guard (lib/s3-tenant-guard) and ApiError run REAL — these tests prove the
// real guard fires on the real signing path.
vi.mock("@/lib/storage/aws-config", () => ({
  getBucketConfig: vi.fn(),
  createS3Client: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

import { getBucketConfig, createS3Client } from "@/lib/storage/aws-config";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getFileUrl, uploadFile } from "@/lib/storage/s3";
import { ApiError } from "@/lib/api-error";

const mockedGetBucketConfig = vi.mocked(getBucketConfig);
const mockedCreateS3Client = vi.mocked(createS3Client);
const mockedGetSignedUrl = vi.mocked(getSignedUrl);

const SIGNED_URL = "https://test-bucket.s3.amazonaws.com/object?X-Amz-Signature=test";

let send: ReturnType<typeof vi.fn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  send = vi.fn().mockResolvedValue({});
  mockedCreateS3Client.mockResolvedValue({ send } as any);
  mockedGetSignedUrl.mockResolvedValue(SIGNED_URL);
  // Default bucket config: a well-formed folderPrefix that the guard strips.
  mockedGetBucketConfig.mockResolvedValue({
    bucketName: "test-bucket",
    folderPrefix: "dev/",
    region: "eu-west-2",
  });
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("getFileUrl tenant-scope (PRD-206 AC-2/AC-5)", () => {
  it("THROWS ApiError 403 on an out-of-scope key and never signs", async () => {
    const err = await getFileUrl("tenants/OTHER/secret.png", {
      tenantId: "B",
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    // The guard fires before any signing — proves no presigned URL leaks.
    expect(mockedGetSignedUrl).not.toHaveBeenCalled();
  });

  it("signs an in-scope key for the owning tenant", async () => {
    const url = await getFileUrl("dev/tenants/B/uploads/logo.png", {
      tenantId: "B",
    });

    expect(url).toBe(SIGNED_URL);
    expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("audited bypass signs cross-tenant AND logs s3.cross_tenant_sign (AC-5)", async () => {
    const reason = "super-admin template preview tooling";
    const url = await getFileUrl("dev/tenants/OTHER/preview.png", {
      bypassTenantScope: true,
      reason,
    });

    expect(url).toBe(SIGNED_URL);
    expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "s3.cross_tenant_sign",
      expect.stringContaining(reason),
    );
  });

  it("legacy call (no options) still signs — back-compat", async () => {
    const url = await getFileUrl("dev/tenants/B/uploads/logo.png");

    expect(url).toBe(SIGNED_URL);
    expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("legacy string contentTypeHint still signs — back-compat", async () => {
    const url = await getFileUrl("dev/tenants/B/uploads/clip.mp4", "video/mp4");

    expect(url).toBe(SIGNED_URL);
    expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1);
  });
});

describe("uploadFile final-key scope (PRD-206 AC-2a)", () => {
  it("THROWS via the guard when folderPrefix pushes the final key outside the tenant scope", async () => {
    // A misconfigured leading-slash folderPrefix: uploadFile concatenates it
    // verbatim into the key (`/dev/tenants/B/uploads/...`), but the guard
    // strips the single leading slash first, so `/dev/` no longer matches and
    // the remainder `dev/tenants/B/...` is NOT inside `tenants/B/`.
    mockedGetBucketConfig.mockResolvedValue({
      bucketName: "test-bucket",
      folderPrefix: "/dev/",
      region: "eu-west-2",
    });

    const err = await uploadFile(
      Buffer.from("x"),
      "logo.png",
      "image/png",
      "tenants/B/",
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    // Threw before PutObject — nothing was written.
    expect(send).not.toHaveBeenCalled();
  });

  it("writes and returns the key for a normal in-scope tenant upload", async () => {
    const key = await uploadFile(
      Buffer.from("x"),
      "logo.png",
      "image/png",
      "tenants/B/",
    );

    expect(key).toMatch(/^dev\/tenants\/B\/uploads\/\d+-logo\.png$/);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
