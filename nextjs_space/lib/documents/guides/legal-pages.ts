import type { Guide } from "../types";

/**
 * Part 17 — The Legal Pages. Written for a non-technical store owner; every
 * claim below matches the shipped behaviour in app/tenant-admin/legal/documents/
 * and lib/legal/ (documents/index.ts, document-resolution.ts, tenant-policy.ts).
 */
export const legal_pagesGuide: Guide = {
  slug: "legal-pages",
  part: 17,
  title: "The Legal Pages",
  navLabel: "Legal Pages",
  adminPath: "/tenant-admin/legal/documents",
  summary:
    "Terms, privacy, cookies, and regulatory pages — maintained wording or your own.",
  status: "published",
  updatedAt: "2026-08-15",
  sections: [
    {
      id: "four-documents",
      kind: "concept",
      title: "Four documents",
      shot: {
        id: "legal-documents",
        caption:
          "One row per document, each with its own Live badge, its own source of wording, and its own publish button.",
        alt: "The Legal Pages screen listing the four legal documents with their status and actions",
      },
      whatFor:
        "Four legal pages are published on your own domain, in your storefront's colours, naming your business. This screen is where each one is turned on.",
      does: [
        "Privacy Policy — how you handle customers' personal information, and the rights they have over it. Lives at /privacy.",
        "Terms of Sale — your contract with your customer: ordering, delivery, returns and liability. Lives at /terms.",
        "Cookie Notice — what is stored on visitors' devices, and what they agreed to. Lives at /cookies.",
        "Regulatory Information — your licence and regulator, and the line between your service and the prescriber. Lives at /regulatory.",
        "All four are built from the details you entered under Company Details (Part 16), so they name your company rather than the platform.",
      ],
      why:
        "These are the pages that make a storefront a business rather than a shopfront. They are already drafted, already correct for a prescription-based cannabis service, and waiting on nothing but your details and a click.",
      notes: [
        "Your storefront footer links to these pages, though which of the four appear depends on the footer your theme uses. All four are reachable by address regardless.",
        "This screen needs the Edit settings permission — team members without it will not see it in the menu.",
        "Every publish and every switch of wording is recorded in Audit Logs.",
      ],
    },
    {
      id: "standard-or-your-own",
      kind: "concept",
      title: "Standard wording, or your own",
      whatFor:
        "Each document is an independent decision: keep the wording BudStacks maintains, or replace it with text of your own. You can mix — standard privacy, your own terms — and change your mind either way.",
      does: [
        "Standard wording is the default, and the row states it plainly — “Standard wording, version … — we keep it current” — naming the version that document is on. When the law moves we update the text; you republish to take it.",
        "Write my own opens a confirmation first, in plain terms: it becomes your document, you are responsible for its content and for keeping it current, and our updates stop reaching it. Who accepted that, and when, is recorded.",
        "Your own text is written in Markdown — ## for a heading, **bold**, and - for a list. The editor reminds you above the box.",
        "Preview, inside the editor, renders your text exactly as the storefront will produce it for customers.",
        "Use standard wording puts the maintained text back and republishes it. Your own text is kept, so switching back later costs nothing.",
      ],
      why:
        "Most owners never need to write a word — the maintained wording is the point of the feature. But if your lawyer has drafted terms you must use, you are not locked out of your own legal pages to keep the convenience.",
      notes: [
        "A document set to your own wording with nothing written is refused at publish rather than published empty — you are told to write it or switch back.",
        "Preview only exists for your own wording. There is no way to read the standard terms, cookie notice or regulatory page before publishing them; the privacy notice is the exception, previewable on Company Details.",
      ],
    },
    {
      id: "publishing",
      kind: "concept",
      title: "Publishing, and the Live badge",
      whatFor:
        "Every row carries a Live or Not live badge. It is not a record of what you intended — the badge is worked out by resolving the document exactly the way your storefront does, so it reports what is genuinely being served.",
      does: [
        "Live, in green: the page is being served on your domain. A View button appears beside it and opens the real thing.",
        "Not live, in amber: visitors reaching that address are told the document has not been published, are given your business name, and are asked to contact you.",
        "Publish (or Republish) on a standard document is a single button — there is nothing to write.",
        "Publishing your own wording is done from inside the editor, alongside Save draft and Preview.",
        "Nothing on this screen ever serves the BudStacks platform's documents on your domain. If yours is not published, the page says so honestly instead of substituting ours.",
      ],
      walkthroughs: [
        {
          title: "Preview and publish your four pages",
          steps: [
            {
              text: "Publish your Company Details first (Part 16). The standard wording cannot go live until you have.",
              note: "Without it, rows here stay Not live however many times you press Publish — the documents have no company to name.",
            },
            {
              text: "Open Legal Pages. You should see four rows: Privacy Policy, Terms of Sale, Cookie Notice, Regulatory Information.",
            },
            {
              text: "Press Publish on Privacy Policy.",
              note: "You should see the row flip to a green Live tick, and a View button appear beside it.",
            },
            {
              text: "Press View. The page opens on your own domain, in your storefront's colours, with your company named in the opening line and a “Last updated” date underneath.",
            },
            {
              text: "Do the same for the other three.",
              note: "If a row stays Not live, that document is missing a detail it needs: terms wants a governing law and a support email, regulatory wants your regulator, the cookie notice wants your privacy contact. Add it on Company Details and publish here again.",
            },
            {
              text: "Only if you have wording of your own to use: press Write my own, read the confirmation, paste your text in, press Preview to check how it renders, then Publish.",
              note: "From that point the document is yours — our updates no longer reach it, and keeping it current is on you.",
            },
          ],
        },
      ],
      why:
        "Four correctly worded legal pages, naming your business, on your own domain, without drafting them and without remembering to revisit them when the law changes. The badge means you never have to guess whether it worked.",
      notes: [
        "A row that stays Not live does not yet say why. The reason is always the same shape: a required detail on Company Details is missing, or your own wording is empty.",
        "Publishing all four is the sensible default even if you think one does not apply. An unpublished page is a visible gap on your storefront.",
      ],
    },
  ],
  improvements: [
    "A preview of the standard terms, cookie notice and regulatory page before publishing — today only the privacy notice can be previewed, on Company Details.",
    "A line on each Not live row saying exactly which detail is missing.",
    "A summary of what changed when BudStacks updates the standard wording, so republishing is an informed decision.",
  ],
};
