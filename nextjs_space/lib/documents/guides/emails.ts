import type { Guide } from "../types";

/**
 * Part 9 — The Email Hub. The exemplar guide: every other guide module
 * follows this shape and depth. Written for a non-technical store owner;
 * every claim below matches the shipped behaviour (email-p2 run).
 */
export const emailsGuide: Guide = {
  slug: "email",
  part: 9,
  title: "The Email Hub",
  navLabel: "Email Templates",
  adminPath: "/tenant-admin/emails",
  summary:
    "One place for every email your store sends — the automatic ones (order confirmations, welcome emails) and the ones you write (newsletters and offers).",
  status: "published",
  updatedAt: "2026-08-15",
  sections: [
    {
      id: "templates",
      kind: "tab",
      title: "Templates",
      shot: {
        id: "emails-templates",
        caption:
          "Your template library — SYSTEM ones are ready-made designs that always work; CUSTOM ones are yours.",
        alt: "The Templates tab listing system and custom email templates",
      },
      whatFor:
        "Templates are the reusable designs behind every email your store sends. You never start from a blank page: duplicate a ready-made template, restyle it, and it becomes yours.",
      does: [
        "SYSTEM templates are maintained by BudStacks and always work — they are your safety net.",
        "Duplicate (the copy icon) creates an editable copy you can brand.",
        "Your custom templates can be edited, deactivated, or deleted at any time — the system default quietly takes over if you remove one.",
      ],
      walkthroughs: [
        {
          title: "Create your first branded template",
          steps: [
            { text: "Open Email Templates in the left menu — you land on this tab." },
            {
              text: "Find “Default Order Confirmation” and click the copy icon on its row.",
              note: "You should see a new CUSTOM row appear — that copy is yours to change.",
            },
            { text: "Click the pencil icon on your copy to open the editor (covered next)." },
            {
              text: "Change the greeting, add your sign-off, press Save.",
              note: "Nothing goes live yet — a template only sends once you map it under Event Triggers.",
            },
          ],
        },
      ],
      why:
        "Every email a customer gets is a brand moment. Ten minutes making the order confirmation look like your shop pays out on every order you ever ship.",
    },
    {
      id: "editor",
      kind: "editor",
      title: "Writing an email",
      shot: {
        id: "emails-new",
        caption: "Visual mode: write like a document on the left, watch the real email render on the right.",
        alt: "The visual email editor with live preview",
      },
      whatFor:
        "The editor is where templates and newsletters get written. Visual mode works like writing a document — your logo, colours and footer are added automatically, so you only ever write the message.",
      does: [
        "Headings, images, and buttons from a simple toolbar — no design skills needed.",
        "Personalise inserts smart tags (the customer's name, their order number) that fill in per recipient — type {{ to see the menu.",
        "The preview shows the real email — exactly what lands in the inbox, at phone or desktop width.",
        "Send test delivers it to your own inbox before any customer ever sees it.",
        "An HTML mode exists for designers who want full control — most owners never need it.",
      ],
      walkthroughs: [
        {
          title: "Personalise and test an email",
          steps: [
            { text: "In the editor, click where the greeting should go and type {{ — a menu of smart tags appears." },
            { text: "Choose “Customer name”. It shows as a small chip in your text.", note: "In the sent email the chip becomes the real name — “Hi Sarah,” not “Hi customer,”." },
            { text: "Toggle the preview between phone and desktop widths to check both." },
            { text: "Press Send test and open your own inbox.", note: "You should receive it within a minute, with sample details filled in." },
          ],
        },
      ],
      why:
        "No designer, no agency, no code. If you can write a WhatsApp message, you can produce a professional branded email.",
      notes: [
        "Images you add are stored permanently — they will not break in old emails months later.",
        "The footer (your business address and the unsubscribe link) is added automatically and cannot be accidentally removed — that is your legal protection, handled.",
      ],
    },
    {
      id: "campaigns",
      kind: "tab",
      title: "Campaigns",
      shot: {
        id: "emails-campaigns",
        caption: "Newsletters and offers, with their status — draft, scheduled, or sent.",
        alt: "The Campaigns tab",
      },
      whatFor:
        "Campaigns are the emails you decide to send — a newsletter, a new-product announcement, a weekend offer — written once and sent to your audience.",
      does: [
        "Same editor as templates, plus an audience picker: newsletter subscribers, consented customers, or a saved segment — with a live count before you commit.",
        "Send now, or schedule for the morning your customers actually read email.",
        "Delivery is tracked per recipient, and a sent campaign locks its content so the record stays true.",
        "Writing in The Wire first? Use “Send as newsletter” on any post — one piece of writing, two audiences.",
      ],
      walkthroughs: [
        {
          title: "Send your first newsletter",
          steps: [
            { text: "On the Campaigns tab, press New Campaign." },
            { text: "Write a subject a customer would open, and the message itself." },
            { text: "Save draft — you land on the campaign's own page." },
            { text: "Pick your audience and check the live recipient count.", note: "The count already excludes anyone who unsubscribed — you cannot email them by mistake." },
            { text: "Press Send test to see it in your inbox first. Happy? Press Send.", note: "You should see per-recipient progress build on the page, then the status flip to Sent." },
          ],
        },
      ],
      why:
        "Your customer list is the one marketing channel no platform can take away from you. Campaigns are how a first-time buyer becomes a regular.",
    },
    {
      id: "segments",
      kind: "tab",
      title: "Segments",
      pro: true,
      shot: {
        id: "emails-segments",
        caption: "Saved audiences — rules, not lists, so they are always up to date.",
        alt: "The Segments tab with saved audience rules",
      },
      whatFor:
        "A segment is a saved rule like “customers who haven't ordered in 60 days”. It is not a fixed list — every time you use it, it finds whoever matches today.",
      does: [
        "Combine rules: last order age, number of orders, tags you've applied, verification status.",
        "Every segment automatically respects consent and unsubscribes.",
        "Pick any segment as a campaign audience and see its live count.",
      ],
      walkthroughs: [
        {
          title: "Build the win-back segment",
          steps: [
            { text: "On the Segments tab, press New Segment and name it “Time to reorder”." },
            { text: "Add the rule: last order more than 60 days ago." },
            { text: "Save, and note the live count of matching customers." },
            { text: "Next time you write a campaign, pick this segment as the audience.", note: "The gentle “we miss you” campaign to this segment is the highest-value email habit in this hub." },
          ],
        },
      ],
      why:
        "Winning back a lapsed customer costs a fraction of finding a new one — and this makes it a repeatable habit instead of a guess.",
    },
    {
      id: "event-triggers",
      kind: "tab",
      title: "Event Triggers",
      shot: {
        id: "emails-events",
        caption: "Which template sends for each automatic moment — and the reorder-reminder switch.",
        alt: "The Event Triggers tab mapping system events to templates",
      },
      whatFor:
        "Some emails send themselves: order confirmed, order shipped, welcome. This tab decides which design each of those moments uses.",
      does: [
        "Each event shows its current template — the system default until you map your own.",
        "The reorder reminder switch (off by default) automatically emails customers a set number of days after a delivered order — consent-checked, once per cycle.",
      ],
      walkthroughs: [
        {
          title: "Put your branded template live",
          steps: [
            { text: "Find the “Order Confirmation” row." },
            { text: "Choose the custom template you made earlier from its dropdown and save." },
            { text: "Place a test order (or wait for the next real one).", note: "The confirmation that arrives is now your branded design — check Activity to see it logged." },
          ],
        },
      ],
      why:
        "Map your branded templates once and every automatic email is on-brand forever. Flip the reorder reminder on and your shop follows up with every customer — while you sleep.",
    },
    {
      id: "activity",
      kind: "tab",
      title: "Activity",
      shot: {
        id: "emails-activity",
        caption: "Every email the store sent — who, what, when, and whether it arrived.",
        alt: "The Activity tab showing the delivery log",
      },
      whatFor: "The answer to “did my customer get that email?” — without asking anyone.",
      does: [
        "Searchable log of every send: recipient, subject, status, time.",
        "Click a row for the detail — if a mail server rejected it, the reason is right there.",
        "The open/click tracking switch above it is off by default (privacy-first); turn it on to see engagement on your campaigns.",
      ],
      why:
        "When a customer says “I never got my confirmation”, you answer in ten seconds with the delivery record in front of you — a support conversation ended, not started.",
    },
  ],
  improvements: [
    "A/B subject-line testing for campaigns.",
    "Per-campaign revenue attribution in Analytics.",
  ],
};
