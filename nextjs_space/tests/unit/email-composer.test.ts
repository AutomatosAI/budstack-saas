import { describe, expect, it } from "vitest";

import {
  asEmailContentJson,
  DEFAULT_TEMPLATE_HTML,
  EMPTY_EMAIL_DOC,
  initialEmailEditorMode,
  isLegacyHtmlTemplate,
  modeSwitchWarning,
  payloadContentJson,
} from "@/components/admin/email/email-editor-mode";
import { DEFAULT_EMAIL_PRIMARY_COLOR } from "@/emails/email-shell";
import {
  EMAIL_BUTTON_BACKGROUND_COLOR,
  EMAIL_BUTTON_DEFAULT_LABEL,
  EMAIL_BUTTON_NAME,
} from "@/lib/email/email-button-node";
import type { EmailContentJson } from "@/lib/email/email-content-json";
import { renderEmailTemplateHtml } from "@/lib/email/email-render-pipeline";
import type { EmailShellTenant } from "@/lib/email/email-shell";

// Email Phase 2 US-012 — the visual composer. Two things are worth asserting,
// and neither is "the toolbar renders":
//
//   1. WHICH REPRESENTATION A SAVE KEEPS. `contentHtml` and `contentJson` are two
//      copies of one email and the save pipeline always prefers the document, so
//      whichever one the author is NOT editing is the one a save destroys. Every
//      rule about opening in a mode and switching between them exists to make
//      that loss deliberate, and they are pure functions so they are checked
//      directly.
//   2. THE BUTTON SURVIVES THE SANITIZER. `lib/security/email-sanitize.ts` is
//      law: it re-checks every declaration juice inlines, and a button whose
//      styles it drops is a plain link in an inbox. The node is written to the
//      allow-list, so the proof is running the real pipeline over it — not
//      reading the node's source back to itself.

/** A custom domain, so expectations do not depend on NEXT_PUBLIC_BASE_DOMAIN. */
const TENANT: EmailShellTenant = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  logoUrl: null,
  primaryColor: "#7c3aed",
  businessAddress1: "1 Sample Street",
  businessCity: "Dublin",
};

const AUTHORED_DOC: EmailContentJson = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

const AUTHORED_HTML = "<html><body><p>Hand written</p></body></html>";

/** Render one button through the real save pipeline and return the HTML. */
function renderButton(attrs: Record<string, unknown>) {
  return renderEmailTemplateHtml({
    contentJson: { type: "doc", content: [{ type: EMAIL_BUTTON_NAME, attrs }]},
    tenant: TENANT,
  });
}

describe("which editor a template opens in", () => {
  it("opens a brand-new template in the composer", () => {
    expect(initialEmailEditorMode(undefined)).toBe("simple");
    expect(isLegacyHtmlTemplate(undefined)).toBe(false);
  });

  it("opens a template that has a document in the composer", () => {
    const initialData = { contentHtml: AUTHORED_HTML, contentJson: AUTHORED_DOC };
    expect(initialEmailEditorMode(initialData)).toBe("simple");
    expect(isLegacyHtmlTemplate(initialData)).toBe(false);
  });

  it("opens a hand-written HTML template in Advanced, with the banner", () => {
    const initialData = { contentHtml: AUTHORED_HTML };
    expect(initialEmailEditorMode(initialData)).toBe("advanced");
    expect(isLegacyHtmlTemplate(initialData)).toBe(true);
  });

  // The column is `Json?`, so everything from a SQL NULL to a JSON `null` to a
  // half-migrated row arrives here. None of them may open the composer: it would
  // show a blank page and the save would put that blank page over the HTML.
  it.each([
    ["a null column", null],
    ["a JSON null", "null"],
    ["an array", [{ type: "paragraph" }]],
    ["a node that is not a document", { type: "paragraph" }],
    ["a document with non-array content", { type: "doc", content: "text" }],
    ["a string", "<p>hi</p>"],
  ])("refuses to open the composer for %s", (_label, contentJson) => {
    expect(asEmailContentJson(contentJson)).toBeNull();
    expect(initialEmailEditorMode({ contentHtml: AUTHORED_HTML, contentJson })).toBe(
      "advanced",
    );
  });

  it("accepts a document with no content at all", () => {
    expect(asEmailContentJson({ type: "doc" })).toEqual({ type: "doc" });
  });
});

describe("switching modes warns before it loses work", () => {
  it("warns when leaving the composer with a document", () => {
    const warning = modeSwitchWarning({
      from: "simple",
      to: "advanced",
      contentJson: AUTHORED_DOC,
      contentHtml: AUTHORED_HTML,
    });
    expect(warning?.confirmLabel).toBe("Switch to HTML");
  });

  it("does not warn when leaving a composer the author never typed into", () => {
    expect(
      modeSwitchWarning({
        from: "simple",
        to: "advanced",
        contentJson: null,
        contentHtml: DEFAULT_TEMPLATE_HTML,
      }),
    ).toBeNull();
  });

  // The loss here is one step later — the next save re-derives contentHtml from
  // the document — but it is the same loss, so it is gated the same way.
  it("warns when entering the composer over hand-written HTML", () => {
    const warning = modeSwitchWarning({
      from: "advanced",
      to: "simple",
      contentJson: null,
      contentHtml: AUTHORED_HTML,
    });
    expect(warning?.confirmLabel).toBe("Switch to visual");
  });

  it.each([
    ["the untouched starter sample", DEFAULT_TEMPLATE_HTML],
    ["an empty body", "   "],
  ])("does not warn when the HTML left behind is %s", (_label, contentHtml) => {
    expect(
      modeSwitchWarning({ from: "advanced", to: "simple", contentJson: null, contentHtml }),
    ).toBeNull();
  });

  it("does not warn when the document is coming back with the author", () => {
    expect(
      modeSwitchWarning({
        from: "advanced",
        to: "simple",
        contentJson: AUTHORED_DOC,
        contentHtml: AUTHORED_HTML,
      }),
    ).toBeNull();
  });

  it("never warns about a switch to the mode already open", () => {
    for (const mode of ["simple", "advanced"] as const) {
      expect(
        modeSwitchWarning({
          from: mode,
          to: mode,
          contentJson: AUTHORED_DOC,
          contentHtml: AUTHORED_HTML,
        }),
      ).toBeNull();
    }
  });
});

describe("what a save sends", () => {
  it("sends the document the author wrote", () => {
    expect(payloadContentJson("simple", AUTHORED_DOC)).toBe(AUTHORED_DOC);
  });

  // The one that matters: a new template's form still carries the starter HTML
  // sample. Sending no document from the composer would save that sample as the
  // author's email, so an empty composer sends an empty document instead.
  it("sends an empty document rather than nothing from an untouched composer", () => {
    expect(payloadContentJson("simple", null)).toEqual(EMPTY_EMAIL_DOC);
  });

  it("sends an explicit null from the HTML editor", () => {
    expect(payloadContentJson("advanced", AUTHORED_DOC)).toBeNull();
  });
});

describe("the button survives the save pipeline", () => {
  it("is a styled anchor, never a <button>", async () => {
    const html = await renderButton({
      href: "https://shop.example/offers",
      label: "Shop the sale",
    });

    expect(html).not.toContain("<button");
    expect(html).toContain('href="https://shop.example/offers"');
    expect(html).toContain("Shop the sale");
  });

  it("keeps every declaration the sanitizer could have dropped", async () => {
    const html = await renderButton({ href: "https://shop.example", label: "Buy" });
    const anchor = html.slice(html.indexOf('href="https://shop.example"'));

    for (const declaration of [
      "display:inline-block",
      `background-color:${EMAIL_BUTTON_BACKGROUND_COLOR}`,
      "border-radius:6px",
      "font-weight:bold",
      "text-decoration:none",
    ]) {
      expect(anchor).toContain(declaration);
    }
  });

  // The regression this pins: the node once wrote all four padding longhands,
  // `@tiptap/html` collapsed them back into `padding: 12px 24px` on the way out
  // (CSSOM shorthand serialisation), and the sanitizer — which takes one unit,
  // not two — dropped the lot. The button reached inboxes as coloured text.
  it("keeps the padding that makes it look like a button", async () => {
    const html = await renderButton({ href: "https://shop.example", label: "Buy" });
    const anchor = html.slice(html.indexOf('href="https://shop.example"'));
    const style = anchor.slice(0, anchor.indexOf(">"));

    expect(style).toContain("padding-left:24px");
    expect(style).toContain("padding-right:24px");
    expect(style).not.toContain("padding:");
    // Height comes from line-height, because vertical padding would complete
    // the shorthand and take the horizontal padding down with it.
    expect(style).toMatch(/line-height:\d+px/);
  });

  // Alignment lands on the wrapper, not the anchor: on the anchor it would
  // centre the label inside the button instead of the button inside the email.
  it("centres the button through the wrapper, not the label", async () => {
    const html = await renderButton({
      href: "https://shop.example",
      label: "Buy",
      textAlign: "center",
    });
    const wrapper = html.slice(0, html.indexOf('href="https://shop.example"'));

    expect(wrapper).toContain("text-align:center");
  });

  it("omits href entirely when the author has not given a URL", async () => {
    const html = await renderButton({ href: null, label: "Coming soon" });

    expect(html).toContain("Coming soon");
    expect(html).not.toContain('href=""');
  });

  it("falls back to the default label", async () => {
    const html = await renderButton({ href: "https://shop.example", label: "  " });

    expect(html).toContain(EMAIL_BUTTON_DEFAULT_LABEL);
  });

  // Declared in the node rather than imported, because that module is bundled
  // for the browser and the shell pulls in react-email. Equality is the reason
  // a button looks like part of the brand rather than a stray green box.
  it("uses the same accent as an unbranded shell", () => {
    expect(EMAIL_BUTTON_BACKGROUND_COLOR).toBe(DEFAULT_EMAIL_PRIMARY_COLOR);
  });
});
