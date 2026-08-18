import sanitizeHtml from "sanitize-html";

/**
 * The article-body HTML policy for authored posts.
 *
 * Lifted VERBATIM out of app/store/[slug]/the-wire/[postSlug]/page.tsx, where
 * it was inlined in the render path. It lives here so the storefront Wire and
 * the platform posts API (`platform_posts`) sanitise with one set of rules
 * instead of two copies that drift apart.
 *
 * Nothing was loosened in the move: the same tag list (sanitize-html defaults
 * plus img/iframe/video), the same attribute map, the same two iframe
 * hostnames, the same allowedStyles map.
 *
 * Note on `allowedStyles`: it is carried over as-is, but it can only ever
 * take effect if `style` is an allowed attribute, and it deliberately is not
 * ("Removed 'style' from global allowlist" below) — so today every inline
 * style is dropped outright, which is the stricter outcome. Keeping the map
 * means the policy is already written should style attributes ever be
 * admitted; it must not be read as evidence that they are.
 */
const postHtmlOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe", "video"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["class", "id"], // Removed 'style' from global allowlist
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
    video: ["src", "width", "height", "controls", "autoplay", "loop", "muted"],
  },
  allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],
  // Controlled whitelist of safe CSS properties
  allowedStyles: {
    "*": {
      // Typography
      color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
      "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      "font-size": [/^\d+(?:px|em|rem|%)$/],
      "font-weight": [/^(?:normal|bold|[1-9]00)$/],
      // Layout
      width: [/^\d+(?:px|em|rem|%)$/],
      height: [/^\d+(?:px|em|rem|%)$/],
      margin: [/^\d+(?:px|em|rem|%)(?: \d+(?:px|em|rem|%))*$/],
      padding: [/^\d+(?:px|em|rem|%)(?: \d+(?:px|em|rem|%))*$/],
      // Background
      "background-color": [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
    },
  },
};

/**
 * Sanitize authored article HTML for storage or render. Returns a safe string
 * — never throws on bad input; anything outside the allowlist is dropped.
 *
 * Accepts null/undefined so callers can hand it a nullable column directly.
 *
 * sanitize-html is used (not isomorphic-dompurify) because it runs on the
 * Node server without the ESM/jsdom breakage that stack causes in the Next
 * build. Content is sanitised on the way IN and again on the way OUT: rows
 * predating a rules change still render under the current policy.
 */
export function sanitizePostHtml(html: string | null | undefined): string {
  return sanitizeHtml(html || "", postHtmlOptions);
}
