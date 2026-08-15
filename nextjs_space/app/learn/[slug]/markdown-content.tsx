import sanitizeHtml from "sanitize-html";

// Server component: markdown → HTML is sanitised with sanitize-html
// (htmlparser2, CommonJS) — no DOM/jsdom dependency. The allow-list mirrors
// the-wire post renderer: only http/https/mailto/tel schemes, and iframes are
// restricted to YouTube/Vimeo embed hosts.
/** Simple markdown-to-HTML renderer for learning center articles */
export function MarkdownContent({ content }: { content: string }) {
  const html = sanitizeHtml(renderMarkdown(content), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "loading", "width", "height"],
      iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "player.vimeo.com"],
  });

  return (
    <div
      className="bs-article max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(md: string): string {
  let html = md
    // Code blocks (``` ... ```)
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) =>
        `<pre><code class="language-${lang || "text"}">${escapeHtml(code.trim())}</code></pre>`,
    )
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Images
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" loading="lazy" />',
    )
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    // Horizontal rule
    .replace(/^---$/gm, "<hr />")
    // Unordered lists
    .replace(/^[*-] (.+)$/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(
    /(<li>[\s\S]*?<\/li>(\n)?)+/g,
    (match) => `<ul>${match}</ul>`,
  );

  // Paragraphs: wrap lines that aren't already wrapped
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<img") ||
        trimmed.startsWith("<blockquote")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
