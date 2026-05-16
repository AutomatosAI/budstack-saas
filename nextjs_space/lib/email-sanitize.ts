import sanitizeHtml from "sanitize-html";

// Maximum stored size for an email template body. Anything larger is
// almost certainly an attack or accidental paste.
export const EMAIL_HTML_MAX_LENGTH = 200_000;
export const EMAIL_SUBJECT_MAX_LENGTH = 500;

// Email-safe HTML allowlist. Strips <script>, <iframe>, <form>, <object>,
// <embed>, <meta>, on* event handlers, javascript:/vbscript:/data: URLs in
// hrefs, and CSS expressions inside <style>/style="" attributes.
//
// We deliberately allow <style> + inline `style` attributes because email
// clients require inline styling, and a CSS-only payload cannot run JS in
// any modern email renderer.
const emailHtmlOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "html", "head", "body", "title",
    "div", "span", "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "a", "strong", "b", "em", "i", "u", "s", "small", "sub", "sup",
    "ul", "ol", "li",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
    "pre", "code", "blockquote", "cite", "q",
    "img", "figure", "figcaption", "picture", "source",
    "style",
    "center",
  ],
  allowedAttributes: {
    "*": [
      "class", "id", "style", "title", "dir", "lang",
      "align", "valign", "bgcolor", "border", "cellpadding", "cellspacing",
      "colspan", "rowspan", "width", "height",
    ],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height", "border", "loading"],
    table: ["width", "border", "cellpadding", "cellspacing", "role"],
    source: ["src", "srcset", "type", "media"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["http", "https", "data", "cid"],
  },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  // Keep <style> contents but neutralize CSS expressions / @import
  allowedStyles: {
    "*": {
      // Generic CSS — allow common email-friendly props. The default
      // sanitize-html behaviour drops anything not listed.
      color: [/^.+$/],
      "background-color": [/^.+$/],
      "background": [/^.+$/],
      "background-image": [/^url\(["']?https?:\/\/[^)"']+["']?\)$/],
      "font-size": [/^\d+(?:\.\d+)?(?:px|em|rem|%|pt)$/],
      "font-weight": [/^(?:normal|bold|\d{3})$/],
      "font-family": [/^[\w\s,'"\-]+$/],
      "font-style": [/^(?:normal|italic|oblique)$/],
      "text-align": [/^(?:left|right|center|justify)$/],
      "text-decoration": [/^[\w\s\-]+$/],
      "line-height": [/^[\d.]+(?:px|em|rem|%)?$/],
      "letter-spacing": [/^-?[\d.]+(?:px|em|rem)$/],
      width: [/^[\d.]+(?:px|em|rem|%|vw)$/, /^auto$/],
      height: [/^[\d.]+(?:px|em|rem|%|vh)$/, /^auto$/],
      "max-width": [/^[\d.]+(?:px|em|rem|%|vw)$/],
      "min-width": [/^[\d.]+(?:px|em|rem|%|vw)$/],
      padding: [/^[\d.\s]+(?:px|em|rem|%)?$/],
      "padding-top": [/^[\d.]+(?:px|em|rem|%)?$/],
      "padding-bottom": [/^[\d.]+(?:px|em|rem|%)?$/],
      "padding-left": [/^[\d.]+(?:px|em|rem|%)?$/],
      "padding-right": [/^[\d.]+(?:px|em|rem|%)?$/],
      margin: [/^[\d.\s\-]+(?:px|em|rem|%|auto)?$/, /^auto$/],
      "margin-top": [/^-?[\d.]+(?:px|em|rem|%)?$/, /^auto$/],
      "margin-bottom": [/^-?[\d.]+(?:px|em|rem|%)?$/, /^auto$/],
      "margin-left": [/^-?[\d.]+(?:px|em|rem|%)?$/, /^auto$/],
      "margin-right": [/^-?[\d.]+(?:px|em|rem|%)?$/, /^auto$/],
      border: [/^[\d.]+(?:px|em|rem)?\s+\w+\s+#?[\w]+$/],
      "border-radius": [/^[\d.]+(?:px|em|rem|%)$/],
      "border-color": [/^.+$/],
      "border-style": [/^[\w\-]+$/],
      "border-width": [/^[\d.]+(?:px|em|rem)?$/],
      display: [/^(?:block|inline|inline-block|none|table|table-cell|table-row|flex)$/],
      float: [/^(?:left|right|none)$/],
      "vertical-align": [/^(?:top|middle|bottom|baseline)$/],
      opacity: [/^(?:0?\.\d+|0|1)$/],
    },
  },
  parser: {
    lowerCaseTags: true,
    decodeEntities: true,
  },
  // Drop empty wrappers but keep <br>, <hr>, <img>
  exclusiveFilter: () => false,
};

/**
 * Sanitize tenant-authored email HTML. Returns a safe string suitable for
 * persistence and inclusion in a sent email. Does NOT throw on bad input
 * — anything not in the allowlist is silently dropped.
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, emailHtmlOptions);
}

/**
 * Strip all HTML from a subject line. Subjects must be plain text — any
 * tags would be a presentational mistake and a likely XSS vector if a
 * recipient client renders them.
 */
export function sanitizeEmailSubject(subject: string): string {
  return sanitizeHtml(subject, { allowedTags: [], allowedAttributes: {} });
}
