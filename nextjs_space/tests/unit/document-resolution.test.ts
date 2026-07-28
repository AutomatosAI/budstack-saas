import { describe, expect, it } from "vitest";
import {
  explainUnpublished,
  resolveDocumentSource,
  type PlatformTemplateRow,
  type TenantDocumentRow,
} from "@/lib/legal/document-resolution";

/**
 * Policy management — which text a storefront serves.
 *
 * The operator is the controller, so they can accept the maintained default or
 * publish their own. These pin the precedence, and the two ways a legal page
 * could silently go blank.
 */

const PUBLISHED = new Date("2026-07-28T00:00:00Z");

function doc(over: Partial<TenantDocumentRow> = {}): TenantDocumentRow {
  return {
    slug: "privacy",
    mode: "default",
    body: null,
    publishedAt: PUBLISHED,
    templateVersion: "1.0.0",
    ...over,
  };
}

const PLATFORM: PlatformTemplateRow = {
  slug: "privacy",
  body: "## Edited default\n\n{{controllerLegalName}}",
  version: "1.1.0",
};

describe("precedence", () => {
  it("serves the tenant's own text in custom mode", () => {
    const result = resolveDocumentSource(
      "privacy",
      doc({ mode: "custom", body: "Our own policy." }),
      PLATFORM,
      true,
    );
    expect(result).toEqual({
      kind: "custom",
      body: "Our own policy.",
      publishedAt: PUBLISHED,
    });
  });

  it("prefers the database default over the shipped one", () => {
    const result = resolveDocumentSource("privacy", doc(), PLATFORM, true);
    expect(result.kind).toBe("default");
    expect(result.kind === "default" && result.template).toContain("Edited default");
    expect(result.kind === "default" && result.fromCodeFallback).toBe(false);
  });

  it("falls back to the shipped template when the table has no row", () => {
    // An unseeded database must degrade to the shipped wording, not to nothing.
    const result = resolveDocumentSource("privacy", doc(), null, true);
    expect(result.kind).toBe("default");
    expect(result.kind === "default" && result.fromCodeFallback).toBe(true);
    expect(result.kind === "default" && result.template.length).toBeGreaterThan(0);
  });
});

describe("a legal page never silently empties", () => {
  it("custom mode with no text serves the fallback, not a blank page", () => {
    const result = resolveDocumentSource(
      "privacy",
      doc({ mode: "custom", body: "   " }),
      PLATFORM,
      true,
    );
    expect(result).toEqual({ kind: "unpublished", reason: "custom-empty" });
  });

  it("custom mode with no text does NOT fall back to the platform default", () => {
    // Substituting our wording for theirs would misrepresent whose document it
    // is — the defect this whole workstream exists to fix.
    const result = resolveDocumentSource(
      "privacy",
      doc({ mode: "custom", body: null }),
      PLATFORM,
      true,
    );
    expect(result.kind).not.toBe("default");
  });

  it("an unpublished document serves the fallback", () => {
    const result = resolveDocumentSource(
      "privacy",
      doc({ publishedAt: null }),
      PLATFORM,
      true,
    );
    expect(result).toEqual({ kind: "unpublished", reason: "not-published" });
  });

  it("a tenant with no document row serves the fallback", () => {
    expect(resolveDocumentSource("privacy", null, PLATFORM, true)).toEqual({
      kind: "unpublished",
      reason: "no-document",
    });
  });
});

describe("the profile gates only the default path", () => {
  it("default mode needs a published profile to merge identity into", () => {
    const result = resolveDocumentSource("privacy", doc(), PLATFORM, false);
    expect(result).toEqual({ kind: "unpublished", reason: "no-profile" });
  });

  it("custom mode does NOT need one — their text carries its own identity", () => {
    const result = resolveDocumentSource(
      "privacy",
      doc({ mode: "custom", body: "Our own policy." }),
      PLATFORM,
      false,
    );
    expect(result.kind).toBe("custom");
  });
});

describe("explainUnpublished", () => {
  it.each([
    ["no-document", /not been set up/i],
    ["not-published", /publish it/i],
    ["custom-empty", /no text has been written/i],
    ["no-profile", /company details/i],
  ] as const)("%s reads as an instruction", (reason, pattern) => {
    expect(explainUnpublished(reason)).toMatch(pattern);
  });
});
