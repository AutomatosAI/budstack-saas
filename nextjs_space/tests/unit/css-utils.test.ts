import { describe, it, expect } from "vitest";
import { sanitizeCss, extractGoogleFontsImports } from "@/lib/security/css-utils";

// Closes PRD-200 AC-3a: prove sanitizeCss strips dangerous CSS injected from
// S3/external sources while preserving safe declarations.
describe("sanitizeCss", () => {
  it("neutralises a </style><script> tag-breakout payload", () => {
    const out = sanitizeCss("a{color:red}</style><script>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<style");
    expect(out).not.toContain("<");
  });

  it("strips expression(), javascript: urls, behavior and -moz-binding", () => {
    expect(sanitizeCss("x{width:expression(alert(1));}")).not.toContain("expression");
    expect(sanitizeCss("x{background:url(javascript:alert(1));}")).not.toContain("javascript:");
    expect(sanitizeCss("x{behavior:url(#default#x);}")).not.toContain("behavior:");
    expect(sanitizeCss("x{-moz-binding:url(evil.xml#x);}")).not.toContain("-moz-binding");
  });

  it("strips @import and @charset declarations", () => {
    const out = sanitizeCss("@import url('https://evil.com/x.css'); @charset 'utf-8'; a{color:red}");
    expect(out).not.toContain("@import");
    expect(out).not.toContain("@charset");
  });

  it("preserves safe declarations unchanged", () => {
    const safe = ".btn { color: #ffffff; font-family: Inter, sans-serif; padding: 8px; }";
    const out = sanitizeCss(safe);
    expect(out).toContain("color: #ffffff");
    expect(out).toContain("font-family: Inter, sans-serif");
    expect(out).toContain("padding: 8px");
  });

  it("returns '' for empty / nullish input", () => {
    expect(sanitizeCss("")).toBe("");
    expect(sanitizeCss(null)).toBe("");
    expect(sanitizeCss(undefined)).toBe("");
  });
});

describe("extractGoogleFontsImports", () => {
  it("returns the Google Fonts @import URL(s)", () => {
    const css = "@import url('https://fonts.googleapis.com/css2?family=Inter'); a{color:red}";
    expect(extractGoogleFontsImports(css)).toEqual([
      "https://fonts.googleapis.com/css2?family=Inter",
    ]);
  });

  it("ignores non-Google @import URLs", () => {
    expect(extractGoogleFontsImports("@import url('https://evil.com/x.css');")).toEqual([]);
  });

  it("returns [] for empty / nullish input", () => {
    expect(extractGoogleFontsImports("")).toEqual([]);
    expect(extractGoogleFontsImports(null)).toEqual([]);
  });
});
