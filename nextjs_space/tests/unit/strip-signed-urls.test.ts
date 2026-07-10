import { describe, it, expect } from "vitest";
import { stripSignedUrls } from "@/lib/templates/strip-signed-urls";

// PRD-220 AC-C3 — regression test for the recursive signed-URL sanitizer.
// A signed URL persisted into template/branding config would 403 after the
// getFileUrl signature expires (lib/storage/s3.ts, expiresIn: 3600).

const PREFIXES = ["tenants/t1/templates/modern"];

function signedUrl(key: string): string {
  return `https://my-bucket.s3.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc123&X-Amz-Expires=3600`;
}

function countXAmz(value: unknown): number {
  return JSON.stringify(value).split("X-Amz").length - 1;
}

describe("stripSignedUrls (PRD-220 AC-C1/AC-C3)", () => {
  it("strips a top-level signed URL back to its relative key", () => {
    const input = {
      heroImageUrl: signedUrl("tenants/t1/templates/modern/uploads/hero.png"),
    };

    const result = stripSignedUrls(input, PREFIXES);

    expect(countXAmz(result)).toBe(0);
    expect(result.heroImageUrl).toBe("uploads/hero.png");
  });

  it("strips a signed URL nested inside an object", () => {
    const input = {
      sections: {
        hero: {
          config: {
            backgroundImageUrl: signedUrl("tenants/t1/templates/modern/uploads/bg.jpg"),
          },
        },
      },
    };

    const result = stripSignedUrls(input, PREFIXES);

    expect(countXAmz(result)).toBe(0);
    expect(result.sections.hero.config.backgroundImageUrl).toBe("uploads/bg.jpg");
  });

  it("strips signed URLs inside an array of objects", () => {
    const input = {
      logos: [
        { src: signedUrl("tenants/t1/templates/modern/uploads/logo-1.png"), alt: "One" },
        { src: signedUrl("tenants/t1/templates/modern/uploads/logo-2.png"), alt: "Two" },
      ],
    };

    const result = stripSignedUrls(input, PREFIXES);

    expect(countXAmz(result)).toBe(0);
    expect(result.logos[0].src).toBe("uploads/logo-1.png");
    expect(result.logos[1].src).toBe("uploads/logo-2.png");
    expect(result.logos[0].alt).toBe("One");
  });

  it("strips signed URLs inside a flat string array", () => {
    const input = {
      avatars: [
        signedUrl("tenants/t1/templates/modern/uploads/avatar-1.png"),
        signedUrl("tenants/t1/templates/modern/uploads/avatar-2.png"),
        "not-a-url",
      ],
    };

    const result = stripSignedUrls(input, PREFIXES);

    expect(countXAmz(result)).toBe(0);
    expect(result.avatars).toEqual([
      "uploads/avatar-1.png",
      "uploads/avatar-2.png",
      "not-a-url",
    ]);
  });

  it("falls back to the decoded full key when no prefix matches", () => {
    const input = {
      imageUrl: signedUrl("templates/other-template/uploads/hero.png"),
    };

    const result = stripSignedUrls(input, PREFIXES);

    expect(countXAmz(result)).toBe(0);
    expect(result.imageUrl).toBe("templates/other-template/uploads/hero.png");
  });

  it("falls back to the raw key instead of throwing on malformed percent-encoding", () => {
    const input = {
      imageUrl: "https://my-bucket.s3.amazonaws.com/uploads/bad%zzname.png?X-Amz-Signature=abc",
    };

    const result = stripSignedUrls(input, PREFIXES);

    expect(countXAmz(result)).toBe(0);
    expect(result.imageUrl).toBe("uploads/bad%zzname.png");
  });

  it("detects an X-Amz-signed URL even without an .amazonaws.com host", () => {
    const input = {
      imageUrl: "https://cdn.example.com/tenants/t1/templates/modern/uploads/hero.png?X-Amz-Signature=abc",
    };

    const result = stripSignedUrls(input, PREFIXES);

    expect(countXAmz(result)).toBe(0);
    expect(result.imageUrl).toBe("uploads/hero.png");
  });

  it("leaves unsigned/relative values, numbers, booleans, and null untouched", () => {
    const input = {
      logoPath: "uploads/logo.png",
      externalLink: "https://example.com/about",
      count: 3,
      enabled: true,
      note: null,
      nested: { path: "uploads/nested.png" },
      list: ["uploads/a.png", "uploads/b.png"],
    };

    const result = stripSignedUrls(input, PREFIXES);

    expect(result).toEqual(input);
  });

  it("does not treat an unrelated host as S3 just because its path/query contains the amazonaws.com marker", () => {
    // CodeQL: substring-matching the whole URL string for ".amazonaws.com/"
    // is spoofable by a path or query on an unrelated host. Real URL parsing
    // must check the hostname, not the raw string.
    const spoofed = {
      pathLike: "https://evil.com/foo.amazonaws.com/bar",
      queryLike: "https://evil.com/redirect?next=https://x.amazonaws.com/y",
    };

    const result = stripSignedUrls(spoofed, PREFIXES);

    expect(result).toEqual(spoofed);
  });

  it("works with no prefixes supplied (defaults to [])", () => {
    const input = { imageUrl: signedUrl("tenants/t1/templates/modern/uploads/hero.png") };

    const result = stripSignedUrls(input);

    expect(countXAmz(result)).toBe(0);
    expect(result.imageUrl).toBe("tenants/t1/templates/modern/uploads/hero.png");
  });
});
