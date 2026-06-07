import sanitizeHtml from "sanitize-html";

// SECURITY (C6): Strict SVG sanitizer for template assets. SVG is a
// scriptable XML document — without sanitization a malicious template
// upload can stage stored XSS that runs inside any tenant store page
// that loads the file. We strip <script>, foreignObject, on* event
// handlers, and javascript:/data: URLs in href/xlink:href.
//
// Only structural SVG elements are kept. Filters/animations are dropped
// because they can carry script via <set>/<animate> values. The <style>
// ELEMENT is also dropped: sanitize-html does not sanitise CSS inside a
// <style> block (it warns about exactly this), so an inlined SVG could ship
// a stylesheet payload. Presentation attributes (fill, stroke, …) and the
// inline `style` attribute are still allowed, which covers icon/logo styling.
//
// Uses sanitize-html (htmlparser2, CommonJS) rather than a DOMPurify/jsdom
// stack, which breaks the Next server build. The parser is told not to
// lower-case tags/attributes because SVG is case-sensitive: viewBox,
// linearGradient, clipPath, gradientUnits etc. must survive verbatim.

const SAFE_SVG_TAGS = [
  "svg",
  "g",
  "title",
  "desc",
  "defs",
  "symbol",
  "use",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "pattern",
  "marker",
  "image",
  "switch",
];

const SAFE_SVG_ATTRS = [
  "id",
  "class",
  "style",
  "viewBox",
  "preserveAspectRatio",
  "xmlns",
  "xmlns:xlink",
  "version",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "pathLength",
  "transform",
  "transform-origin",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "opacity",
  "color",
  "display",
  "visibility",
  "clip-path",
  "clip-rule",
  "mask",
  "filter",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
  "markerUnits",
  "markerWidth",
  "markerHeight",
  "refX",
  "refY",
  "orient",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "alignment-baseline",
  "letter-spacing",
  "word-spacing",
  "text-decoration",
  "dx",
  "dy",
  "rotate",
  "lengthAdjust",
  "textLength",
  "href",
  "xlink:href",
];

/**
 * Sanitize an SVG document body. Returns a safe SVG string with
 * scripts/event handlers/dangerous URL schemes removed. Returns an empty
 * string if the input is not a valid SVG.
 */
export function sanitizeSvg(svg: string): string {
  if (typeof svg !== "string" || !svg.trim()) return "";
  // Allow-list model: any tag not in SAFE_SVG_TAGS (script, foreignObject,
  // animate, set, …) is discarded, and any attribute not in SAFE_SVG_ATTRS
  // (on* handlers, etc.) is stripped. javascript:/vbscript:/data: URLs are
  // rejected because only http/https/mailto/tel schemes are permitted on the
  // href/xlink:href attributes that accept a scheme.
  return sanitizeHtml(svg, {
    allowedTags: SAFE_SVG_TAGS,
    allowedAttributes: { "*": SAFE_SVG_ATTRS },
    // SVG is case-sensitive — keep viewBox/linearGradient/clipPath verbatim.
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "xlink:href"],
    allowProtocolRelative: false,
  });
}

/**
 * Detect if a buffer's content claims to be an SVG. Used at upload time
 * to decide whether to apply sanitizeSvg before persisting.
 */
export function isLikelySvg(buffer: Buffer | string): boolean {
  const head = (
    typeof buffer === "string" ? buffer : buffer.toString("utf-8", 0, 512)
  )
    .trimStart()
    .toLowerCase();
  return head.startsWith("<?xml") ? head.includes("<svg") : head.startsWith("<svg");
}
