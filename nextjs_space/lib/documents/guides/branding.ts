import type { Guide } from "../types";

/**
 * Part 6 — The Look. Written for a non-technical store owner; every claim
 * below matches the shipped behaviour in app/tenant-admin/branding/.
 */
export const brandingGuide: Guide = {
  slug: "branding",
  part: 6,
  title: "The Look",
  navLabel: "Branding",
  adminPath: "/tenant-admin/branding",
  summary:
    "Your storefront's identity — colours, logo, layout, and content, edited live.",
  status: "published",
  updatedAt: "2026-08-15",
  sections: [
    {
      id: "brand",
      kind: "tab",
      title: "Brand",
      shot: {
        id: "branding",
        caption:
          "The Store Editor: controls on the left, your actual storefront drawing itself on the right.",
        alt: "The branding editor with the Brand tab open and the live preview pane beside it",
      },
      whatFor:
        "Your identity, in one tab: business name, logo, favicon, the colours the whole site is built from, and your typefaces. Change any of them and the preview on the right redraws while you watch.",
      does: [
        "Business Information — the name shown across your site, and a tagline.",
        "Brand Images — your logo (a PNG or SVG with a transparent background works best) and your favicon, the small icon in the browser tab.",
        "Logo Placement — how large the logo sits in the menu bar, and whether it also appears over your hero image; drag it on the small preview to position it.",
        "Colours — six choices named in plain words: Button, Call-to-Action, Links & Highlights, Page Background, Heading Text and Body Text.",
        "Design — button shape, size and hover effect; card corners, shadows and spacing; glass effects, scroll animations and the shape of the divider between sections.",
        "Typography — a body font and a heading font, their sizes and weights, and letter spacing.",
      ],
      walkthroughs: [
        {
          title: "Put your logo and colours on the site",
          steps: [
            {
              text: "Open Branding. You land on the Brand tab with the preview on the right.",
            },
            {
              text: "Under Brand Images, choose your logo file.",
              note: "You should see it appear in the preview's menu bar within a second. Nothing was saved — you are just looking at it.",
            },
            {
              text: "Scroll to Colours and set Button and Call-to-Action to your brand colour.",
              note: "Every button in the preview changes at once, including the ones further down the page.",
            },
            {
              text: "Leave the other four alone unless something looks wrong.",
              note: "Colours you never touch keep following your theme's own palette — you are not expected to fill in all six.",
            },
          ],
        },
      ],
      why:
        "Customers decide whether a shop is real in about two seconds, and they decide on the logo and the colours. This is the cheapest credibility you will ever buy.",
      notes: [
        "Only the colours you actually change are saved. The rest stay tied to the theme, which means a theme improvement still reaches them.",
        "Business Name is required — the editor will not publish with it empty.",
      ],
    },
    {
      id: "layout",
      kind: "tab",
      title: "Layout",
      shot: {
        id: "branding-layout",
        caption:
          "The running order of your homepage — drag a section by its handle to move it.",
        alt: "The Layout tab listing the homepage sections in order with drag handles",
      },
      whatFor:
        "The running order of your page. Every band a visitor scrolls through — the hero, the product showcase, the testimonials, the call to action — is a section in this list, and this is where you decide which exist and in what order.",
      does: [
        "Drag a section by the handle on its left to move it up or down the page.",
        "Add Section opens a library grouped by purpose — heroes, calls to action, content sections — each with a line describing what it does.",
        "The bin takes a section off the page.",
        "The order in this list is the order a visitor scrolls, top to bottom.",
      ],
      walkthroughs: [
        {
          title: "Move a section up the page",
          steps: [
            {
              text: "Open the Layout tab. Your sections are listed in the order they currently appear.",
            },
            { text: "Grab the handle to the left of a section and drag it above another." },
            {
              text: "Look at the preview — the page has already re-ordered itself.",
              note: "Putting your product showcase directly under the hero is the single most common change owners make here, and usually the one that pays.",
            },
          ],
        },
      ],
      why:
        "Most visitors never reach the bottom of a homepage. Deciding what they meet first is a five-second drag, and it moves more people towards your products than any amount of rewriting.",
      notes: [
        "Removing a section is not a hide switch. You can add the same type back from the library, but it returns with its default wording rather than the copy you had written.",
        "Section names come from your theme, so this list is different from store to store.",
      ],
    },
    {
      id: "content",
      kind: "tab",
      title: "Content",
      shot: {
        id: "branding-content",
        caption:
          "One panel per section — open it and the preview scrolls to the band you are editing.",
        alt: "The Content tab with a section panel expanded showing its Content and Colour sub-tabs",
      },
      whatFor:
        "The words, pictures and product picks inside each section, plus your menu and your footer. Everything a customer actually reads is edited here.",
      does: [
        "Navigation — pick a menu style, edit the menu links, set the button at the top-right, and choose whether the cart icon shows.",
        "One panel per section, in page order. Open it and you get exactly the fields that section has: headings, body text, images, videos, buttons, and lists you can add rows to.",
        "Selecting a section scrolls the preview to it and flashes an outline around it, so you always know which band you are editing.",
        "Product sections can point at real products from your catalogue with a picker, instead of hand-typed placeholders — see Part 2, The Catalogue.",
        "Each section also has a Colour sub-tab, for the times one band needs to break from the site palette.",
        "Swap variant changes a section to a different design in the same family and carries your wording across.",
        "Sections you have edited are marked with a dot and the word “edited”, so you can see at a glance what you have touched.",
        "Footer — style, tagline, address, email, disclaimer, link columns and social links.",
      ],
      walkthroughs: [
        {
          title: "Rewrite the words on your hero",
          steps: [
            { text: "Open the Content tab and click your hero section to expand it." },
            {
              text: "Watch the preview jump to that band and flash an outline round it.",
              note: "On a page with a dozen sections, that highlight is the fastest way to be sure you are editing the one you meant.",
            },
            {
              text: "Change the headline and sub-heading. The preview updates as you type.",
            },
            {
              text: "Set the button text to something a customer would actually click — “Check if you're eligible” beats “Learn more” every time.",
            },
          ],
        },
      ],
      why:
        "A template's placeholder copy is written for nobody. Twenty minutes replacing it with your own words — what you sell, who you sell it to, what happens next — is the difference between a demo site and a shop.",
      notes: [
        "The scroll-and-highlight works on the desktop preview only. Tablet and mobile are real browser frames, so they cannot be driven from the editor.",
      ],
    },
    {
      id: "publish",
      kind: "concept",
      title: "Previewing and publishing",
      whatFor:
        "The right-hand pane is your real storefront, drawn with the changes you have made but not yet saved. Publish Site is the moment those changes reach the public.",
      does: [
        "The desktop preview redraws as you work — it is the live one, and it includes everything you have not saved yet.",
        "The tablet and mobile buttons load your storefront at those screen widths in a real browser frame, so menus and stacking behave exactly as a phone would.",
        "Preview, at the top right, opens the same thing full-size in a new tab.",
        "Publish Site saves all three tabs at once and applies them to every page of your store.",
      ],
      walkthroughs: [
        {
          title: "Refresh your homepage in ten minutes",
          steps: [
            {
              text: "Brand tab: upload your logo, then set Button and Call-to-Action to your brand colour.",
            },
            {
              text: "Still on Brand, scroll to Typography and choose a heading font.",
              note: "One font change moves the look further than an hour of anything else on this page.",
            },
            { text: "Layout tab: drag your product section directly under the hero." },
            {
              text: "Content tab: open the hero and rewrite the headline, sub-heading and button text in your own words.",
            },
            {
              text: "Press Publish Site.",
              note: "You should see “Branding updated successfully” and the change is live on your storefront from the next page load.",
            },
            {
              text: "Now switch the preview to Mobile and scroll through it.",
              note: "The phone and tablet frames load your published site, so this check is honest only after publishing — do it last, not first.",
            },
          ],
        },
      ],
      why:
        "You can try anything here. Nothing a visitor sees changes until you press one button, so the expensive fear — breaking your own shop while experimenting — simply does not apply.",
      notes: [
        "The flip side of “nothing is live until you publish”: leaving the page before publishing throws your changes away. There is no draft kept for you.",
        "Publishing writes to whichever design you are editing. If you arrived here from a theme's Customize button, you are editing that theme — which may not be the one your customers are currently seeing. Part 8, The Theme Library, explains which is which.",
      ],
    },
  ],
  improvements: [
    "Undo, and a history of published versions to roll back to.",
    "A hide switch for sections — today removing and re-adding is the only route.",
  ],
};
