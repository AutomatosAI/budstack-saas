/**
 * Minimal Markdown renderer for BudStacks-managed legal documents.
 *
 * Deliberately not a general Markdown implementation. It supports exactly the
 * constructs the legal templates use — h2, paragraphs, bold, unordered lists and
 * pipe tables — so there is no dependency to add to a frozen lockfile and no
 * parser surface beyond what we actually ship.
 *
 * Escape-first: every text node is HTML-escaped BEFORE any tag is introduced, so
 * the only tags in the output are ones this module emits. Tenant-supplied merge
 * values are escaped by the same pass, which is why rendering is safe even
 * though operators control fields like `controllerLegalName`.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-009).
 */

const BOLD = /\*\*([^*]+)\*\*/g;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape, then apply the one inline construct the templates use. */
function inline(text: string): string {
  return escapeHtml(text).replace(BOLD, "<strong>$1</strong>");
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|");
}

/** `| a | b |` -> ["a", "b"] */
function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isDividerRow(line: string): boolean {
  return tableCells(line).every((cell) => /^:?-{2,}:?$/.test(cell));
}

function renderTable(lines: string[]): string {
  const rows = lines.filter((line) => !isDividerRow(line)).map(tableCells);
  if (rows.length === 0) return "";

  const [header, ...body] = rows;
  const head = `<thead><tr>${header
    .map((cell) => `<th>${inline(cell)}</th>`)
    .join("")}</tr></thead>`;
  const rest = body
    .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `<table>${head}<tbody>${rest}</tbody></table>`;
}

function renderList(lines: string[]): string {
  const items = lines
    .map((line) => line.replace(/^\s*-\s+/, ""))
    .map((item) => `<li>${inline(item)}</li>`)
    .join("");
  return `<ul>${items}</ul>`;
}

function renderBlock(block: string): string {
  const lines = block.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return "";

  if (lines[0].startsWith("## ")) {
    return `<h2>${inline(lines[0].slice(3).trim())}</h2>`;
  }

  if (lines.every(isTableRow)) {
    return renderTable(lines);
  }

  if (lines.every((line) => /^\s*-\s+/.test(line))) {
    return renderList(lines);
  }

  return `<p>${inline(lines.join(" "))}</p>`;
}

/** Render a legal template body to HTML. */
export function renderMarkdown(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map(renderBlock)
    .filter(Boolean)
    .join("\n");
}
