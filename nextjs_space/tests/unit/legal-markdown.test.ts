import { describe, expect, it } from "vitest";
import { escapeHtml, renderMarkdown } from "@/lib/legal/markdown";
import { renderPolicyHtml } from "@/lib/legal/tenant-policy";

/**
 * WS2 US-009 — the storefront privacy page injects this output with
 * dangerouslySetInnerHTML, so "tenant input cannot introduce a tag" must be a
 * proven property, not a comment.
 *
 * Operators control controllerLegalName, registeredAddress, privacyContactEmail
 * and the optional DPO / representative fields through the tenant admin. Every
 * one of them lands inside the rendered document.
 */

const BASE = {
  controllerLegalName: "HealingBuds Ltd",
  registeredAddress: "12 Example Street, London EC1A 1AA",
  privacyContactEmail: "privacy@healingbuds.com",
};

describe("escapeHtml", () => {
  it("escapes the tag and attribute characters", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;",
    );
  });
});

describe("renderMarkdown", () => {
  it("renders headings, paragraphs and bold", () => {
    const html = renderMarkdown("## Title\n\nSome **bold** text.");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<p>Some <strong>bold</strong> text.</p>");
  });

  it("renders unordered lists", () => {
    const html = renderMarkdown("- one\n- two");
    expect(html).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders tables and drops the divider row", () => {
    const html = renderMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>1</td>");
    expect(html).not.toContain("---");
  });

  it("escapes raw HTML in the source rather than passing it through", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(html).not.toContain("<script>");
  });
});

/**
 * The tags the renderer is allowed to emit. Anything else in the output came
 * from input, which would mean escaping failed.
 *
 * Note this is a TAG check, not a substring check: `onerror=` legitimately
 * survives inside escaped text (`&lt;img src=x onerror=&quot;…&quot;&gt;`),
 * where it is inert character data rather than an attribute. Asserting on the
 * substring would fail on correctly-escaped output.
 */
const ALLOWED_TAGS = new Set([
  "h2", "p", "ul", "li", "strong", "table", "thead", "tbody", "tr", "th", "td",
]);

function disallowedTags(html: string): string[] {
  const tags = [...html.matchAll(/<\/?([a-z0-9]+)/gi)].map((m) => m[1].toLowerCase());
  return [...new Set(tags)].filter((tag) => !ALLOWED_TAGS.has(tag));
}

describe("tenant input cannot inject markup", () => {
  it.each([
    ["script tag", "<script>alert(1)</script>"],
    ["img onerror", '<img src=x onerror="alert(1)">'],
    ["closing tag breakout", "</p><script>alert(1)</script><p>"],
    ["attribute breakout", '" onmouseover="alert(1)'],
    ["iframe", "<iframe src='javascript:alert(1)'></iframe>"],
  ])("neutralises %s in controllerLegalName", (_label, payload) => {
    const html = renderPolicyHtml({ ...BASE, controllerLegalName: payload });

    expect(disallowedTags(html)).toEqual([]);
    // The payload survives only in escaped form, never verbatim.
    expect(html).not.toContain(payload);
  });

  it("neutralises a payload in the registered address", () => {
    const html = renderPolicyHtml({
      ...BASE,
      registeredAddress: "<script>alert(1)</script>",
    });
    expect(disallowedTags(html)).toEqual([]);
    expect(html).toContain("&lt;script&gt;");
  });

  it("neutralises a payload in an optional field", () => {
    const html = renderPolicyHtml({
      ...BASE,
      dpoName: "<img src=x onerror=alert(1)>",
      dpoContact: "dpo@example.com",
    });
    expect(disallowedTags(html)).toEqual([]);
    expect(html).toContain("&lt;img");
  });

  it("resolves a conditional nested inside a kept conditional", () => {
    // Regression: one replace pass left {{#dpoContact}} intact inside
    // {{#dpoName}}, which tripped the unresolved-token guard and took the
    // whole notice down rather than rendering it.
    const html = renderPolicyHtml({
      ...BASE,
      dpoName: "Jordan Reeves",
      dpoContact: "dpo@example.com",
    });
    expect(html).not.toContain("{{");
    expect(html).toContain("dpo@example.com");
  });

  it("stops block-level markdown injection through a multi-line value", () => {
    // A newline in a merge value would otherwise let an operator open a new
    // block and forge a heading in the middle of a legal document.
    const html = renderPolicyHtml({
      ...BASE,
      registeredAddress: "12 Example Street\n\n## Your rights are waived",
    });
    expect(html).not.toContain("<h2>Your rights are waived</h2>");
  });

  it("still renders the operator's real name", () => {
    const html = renderPolicyHtml({ ...BASE, controllerLegalName: "Küche & Co Ltd" });
    expect(html).toContain("Küche &amp; Co Ltd");
  });

  it("emits only the tags the renderer itself produces", () => {
    const html = renderPolicyHtml({
      ...BASE,
      controllerLegalName: "<b>x</b>",
      registeredAddress: "<u>y</u>",
      dpoName: "<i>z</i>",
      dpoContact: "<em>w</em>",
      ukRepresentative: "<span>v</span>",
      icoRegistrationNumber: "<div>u</div>",
    });

    expect(disallowedTags(html)).toEqual([]);
  });
});
