import DOMPurify from "isomorphic-dompurify";

// SECURITY (C6): Strict SVG sanitizer for template assets. SVG is a
// scriptable XML document — without sanitization a malicious template
// upload can stage stored XSS that runs inside any tenant store page
// that loads the file. We strip <script>, foreignObject, on* event
// handlers, and javascript:/data: URLs in href/xlink:href.
//
// Only structural SVG elements are kept. Filters/animations are dropped
// because they can carry script via <set>/<animate> values.

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
  "style",
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
  const sanitized = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: false },
    ALLOWED_TAGS: SAFE_SVG_TAGS,
    ALLOWED_ATTR: SAFE_SVG_ATTRS,
    // Block javascript:, data: (except images), vbscript: in href attrs
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/|\.\.?\/|[^:]*$)/i,
    // Drop <foreignObject> entirely — it can host arbitrary HTML
    FORBID_TAGS: ["foreignObject", "script"],
    FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus"],
    KEEP_CONTENT: false,
  });
  // DOMPurify returns string when SAFE_FOR_TEMPLATES is not set
  return typeof sanitized === "string" ? sanitized : "";
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
