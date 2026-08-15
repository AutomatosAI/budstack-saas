import { describe, expect, it } from "vitest";

import { sanitizePostHtml } from "@/lib/security/post-sanitize";

/**
 * US-003 — the article sanitiser moved out of the Wire render path into lib/
 * so the storefront and the platform posts API share one policy.
 *
 * These assertions are the policy, written down. They exist to fail loudly if
 * someone widens the allowlist without meaning to: the whole point of the
 * extraction is that there is now exactly one place to widen, and widening it
 * affects every article surface at once.
 */
describe("sanitizePostHtml", () => {
  describe("hostile input", () => {
    it("drops <script> and its contents", () => {
      const out = sanitizePostHtml('<p>hi</p><script>alert("xss")</script>');
      expect(out).toContain("<p>hi</p>");
      expect(out).not.toContain("script");
      expect(out).not.toContain("alert");
    });

    it("strips on* event handlers while keeping the element", () => {
      const out = sanitizePostHtml('<p onclick="steal()">copy</p>');
      expect(out).toBe("<p>copy</p>");
    });

    it("drops a javascript: href", () => {
      const out = sanitizePostHtml('<a href="javascript:alert(1)">x</a>');
      expect(out).not.toContain("javascript:");
    });

    it("drops <style> blocks", () => {
      const out = sanitizePostHtml("<style>body{display:none}</style><p>hi</p>");
      expect(out).toBe("<p>hi</p>");
    });

    it("drops the style attribute — it is not in the attribute allowlist", () => {
      const out = sanitizePostHtml('<p style="color:#fff">hi</p>');
      expect(out).toBe("<p>hi</p>");
    });
  });

  describe("authored formatting survives", () => {
    it("keeps headings, lists, links and emphasis", () => {
      const html =
        '<h2>Heading</h2><ul><li><strong>bold</strong> and <em>italic</em></li></ul>' +
        '<p><a href="https://budstacks.io">link</a></p>';
      expect(sanitizePostHtml(html)).toBe(html);
    });

    it("keeps class and id on any element", () => {
      const out = sanitizePostHtml('<p class="lead" id="intro">hi</p>');
      expect(out).toContain('class="lead"');
      expect(out).toContain('id="intro"');
    });

    it("keeps an img with its allowed attributes", () => {
      const out = sanitizePostHtml(
        '<img src="https://cdn.example.com/a.png" alt="a" title="t" width="800" height="600" />',
      );
      expect(out).toContain('src="https://cdn.example.com/a.png"');
      expect(out).toContain('alt="a"');
      expect(out).toContain('width="800"');
      expect(out).toContain('height="600"');
    });

    it("keeps a video with its playback attributes", () => {
      const out = sanitizePostHtml('<video src="/clip.mp4" controls loop muted></video>');
      expect(out).toContain("<video");
      expect(out).toContain('src="/clip.mp4"');
      expect(out).toContain("controls");
    });
  });

  describe("iframe embeds are limited to two hostnames", () => {
    it("keeps a YouTube embed", () => {
      const out = sanitizePostHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
      expect(out).toContain("<iframe");
      expect(out).toContain("youtube.com/embed/abc");
    });

    it("keeps a Vimeo embed", () => {
      const out = sanitizePostHtml('<iframe src="https://player.vimeo.com/video/123"></iframe>');
      expect(out).toContain("<iframe");
      expect(out).toContain("player.vimeo.com/video/123");
    });

    it("drops an embed from any other host", () => {
      const out = sanitizePostHtml('<iframe src="https://evil.example.com/x"></iframe>');
      expect(out).not.toContain("evil.example.com");
    });

    it("drops a youtube.com lookalike hostname", () => {
      const out = sanitizePostHtml('<iframe src="https://www.youtube.com.evil.io/x"></iframe>');
      expect(out).not.toContain("youtube.com.evil.io");
    });
  });

  describe("empty input", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["empty string", ""],
    ])("returns an empty string for %s", (_label, input) => {
      expect(sanitizePostHtml(input)).toBe("");
    });
  });
});
