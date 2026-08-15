import type { Guide } from "../types";

/**
 * Part 15 — Cookies & Consent. Written for a non-technical store owner; every
 * claim below matches the shipped behaviour in app/tenant-admin/cookie-settings/,
 * components/cookie-consent.tsx and lib/cookie-utils.ts.
 */
export const cookie_settingsGuide: Guide = {
  slug: "cookie-settings",
  part: 15,
  title: "Cookies & Consent",
  navLabel: "Cookie Settings",
  adminPath: "/tenant-admin/cookie-settings",
  summary:
    "Your storefront's cookie banner and privacy compliance — set once, correct for your region.",
  status: "published",
  video: { youtubeId: "TyKwGR97M0Y", title: "Compliance, Handled" },
  updatedAt: "2026-08-15",
  sections: [
    {
      id: "compliance-region",
      kind: "concept",
      title: "Your Compliance Region",
      shot: {
        id: "cookie-settings",
        caption:
          "Three stacked cards: the region worked out for you, the banner your visitors see, and the categories your store uses.",
        alt: "The Cookie & Privacy Settings page showing compliance region, cookie banner and cookie categories",
      },
      whatFor:
        "The first card tells you which privacy rules your store falls under. You do not choose any of it — it follows from your store's country, and everything else on the page is already built to match.",
      does: [
        "Country Code is the two-letter code on your store profile. The other three values are worked out from it.",
        "Consent Model reads opt-in or opt-out. Opt-in means nothing beyond the essential cookies is set until a visitor agrees. Opt-out means the visitor can turn things off rather than having to turn them on.",
        "GDPR Applies reads Yes for the EU and the UK.",
        "POPIA Applies reads Yes for South Africa.",
        "Opt-in stores get an extra amber note on the card stating the rule in one line: explicit consent before any non-essential cookie.",
        "The EU, the UK, South Africa, Brazil, Switzerland, Norway, Iceland and Liechtenstein are treated as opt-in. The US and everywhere else are treated as opt-out.",
      ],
      why:
        "You never have to work out which privacy law your shop sits under, or what that law expects a cookie banner to do. One field on your profile decides it, and the storefront behaves accordingly from that moment.",
      notes: [
        "All four values are read-only here. If the country is wrong, change Country Code on your profile page — opened from your account menu in the top bar — and this card follows.",
        "A store with no country set is treated as opt-in: the strictest reading, chosen deliberately so a blank field can never quietly weaken your position.",
      ],
    },
    {
      id: "cookie-banner",
      kind: "concept",
      title: "Cookie Banner",
      whatFor:
        "The strip along the bottom of your storefront that a visitor sees on their first visit. This card decides whether it appears and what it says.",
      does: [
        "Enable Cookie Banner is on by default. Leave it on — it is the thing that collects the consent your region expects.",
        "Custom Banner Message replaces the default wording. Leave it empty and visitors see the standard message written for your consent model.",
        "The buttons change with your region on their own: opt-in storefronts show Reject All beside Accept All, at equal weight; opt-out storefronts show Got it and Manage Cookies.",
        "Customize (Manage Cookies in opt-out regions) opens a panel where the visitor decides category by category — Essential, Analytics, Marketing, Preferences.",
        "A visitor's answer is remembered for a year. The banner does not reappear in that time.",
        "There is a Cookie Policy URL field for a link to a detailed cookie page.",
      ],
      walkthroughs: [
        {
          title: "Check your banner is right for your region",
          steps: [
            {
              text: "Open Cookie Settings and read the Your Compliance Region card. Note whether it says opt-in or opt-out.",
              note: "Opt-in is the stricter of the two — it is the one whose banner must offer a plain Reject All.",
            },
            {
              text: "Leave Enable Cookie Banner on, and leave Custom Banner Message empty for now.",
            },
            { text: "Press Save Cookie Settings." },
            {
              text: "Open your storefront in a private or incognito window.",
              note: "You should see the banner along the bottom. In an opt-in region it offers Reject All and Accept All side by side; in an opt-out region it offers Got it.",
            },
            {
              text: "Click Customize (or Manage Cookies) and read the four rows.",
              note: "Essential is marked Always On and cannot be switched off. That is correct — sign-in, the basket and the checkout do not work without it.",
            },
            {
              text: "Choose Reject All, then reload the page.",
              note: "The banner should not come back. The visitor's choice was recorded, and only the essential cookies are now in play.",
            },
          ],
        },
      ],
      why:
        "The cookie banner is the first thing a regulator looks for and the first thing a cautious customer notices. It is already correct for your region before you touch anything, and the only real decision left is whether to write the message in your own voice.",
      notes: [
        "Writing your own message replaces the wording chosen for your consent model — worth keeping in mind if you are in an opt-in region, where the message is doing legal work as well as explaining itself.",
        "The Cookie Policy URL field is saved but nothing on the storefront reads it yet. Your cookie notice is published from Legal Pages (Part 17) and lives at /cookies on your own domain — that is the page customers actually reach.",
        "Once a visitor has decided, there is currently no link on the storefront that reopens the banner for them. Clearing their browser cookies is the only route back.",
      ],
    },
    {
      id: "cookie-categories",
      kind: "concept",
      title: "Cookie Categories",
      whatFor:
        "Which optional categories your store uses at all. This is your store's own declaration, separate from what any individual visitor agrees to.",
      does: [
        "Essential Cookies is a fixed row marked Always Enabled — sign-in, the basket, the checkout, fraud protection. Nothing to decide, and nothing that can be switched off.",
        "Analytics Cookies is off by default. Switching it on is what allows a Google Analytics tag to load at all.",
        "Marketing Cookies is off by default, for personalised advertising and retargeting.",
        "Save Cookie Settings writes both switches.",
      ],
      why:
        "This is where you say what your store does, once, in a place your published cookie notice can be trusted to match. Leaving both switches off is a perfectly good answer, and the one most stores start from.",
      notes: [
        "Analytics needs two things to be true: this switch on, and the individual visitor agreeing on the banner. Off here means no measurement for anybody, however they answered. On here still measures nobody who declined — including in opt-out regions, where nothing is counted until a visitor actively agrees.",
        "The Google Analytics tag also needs the Pro plan and a measurement ID saved under SEO. All of that is covered in Part 7.",
        "Marketing Cookies is stored but nothing on the storefront acts on it yet — no advertising or retargeting tags load either way. The visitor banner still offers Marketing as a choice.",
        "The visitor banner also offers a Preferences category, which has no switch on this page.",
      ],
    },
  ],
  improvements: [
    "A Cookie preferences link in the storefront footer, so a visitor can reopen the banner and change their mind.",
    "The Cookie Policy URL field wired to the banner, or retired in favour of the cookie notice you publish under Legal Pages.",
    "Marketing tags to go with the marketing switch, and a Preferences switch to match the one visitors see.",
    "Cookie setting changes recorded in Audit Logs alongside your other settings.",
  ],
};
