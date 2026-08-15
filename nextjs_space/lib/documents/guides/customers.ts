import type { Guide } from "../types";

/**
 * Part 4 — The Customer Book. Written for a non-technical store owner; every
 * claim matches the shipped behaviour of app/tenant-admin/customers (list,
 * detail, tags, marketing consent, GDPR erasure).
 */
export const customersGuide: Guide = {
  slug: "customers",
  part: 4,
  title: "The Customer Book",
  navLabel: "Customers",
  adminPath: "/tenant-admin/customers",
  summary:
    "Everyone who shops with you — their details, their history, the labels you put on them, and what you're allowed to email them about.",
  status: "published",
  updatedAt: "2026-08-15",
  sections: [
    {
      id: "list",
      kind: "tab",
      title: "The customer list",
      shot: {
        id: "customers",
        caption:
          "Everyone who has registered or ordered, newest first — with search, sorting, and a count of what each person has bought.",
        alt: "The Customers list with stat cards, search, and a table of customers",
      },
      whatFor:
        "One list of every person who has registered or ordered on your store. This is where you find someone, and where you get a feel for how the base is growing.",
      does: [
        "Three counters across the top: Total Customers, Active Customers, and Recent Sign-ups in the last 30 days.",
        "Search matches name, email, or phone. Partial words are fine and capitals don't matter — typing \"sar\" finds Sarah.",
        "Click the Customer, Email, or Joined headings to sort by them; click again to reverse.",
        "The Orders column shows how many orders each person has placed — that column is how you spot a regular.",
        "Once you have tagged anybody, a tag dropdown appears next to the search box and narrows the list to one label.",
        "Rows per page runs from 10 to 100, with first and last buttons — the heading tells you how many matched.",
        "Export downloads what's on screen as a spreadsheet file: name, email, phone, order count, and join date.",
        "A red \"ID upload failed\" pill marks anyone whose ID document didn't make it through at sign-up — they stay unverified until it's re-uploaded.",
        "View opens that person's own page, covered next.",
      ],
      why:
        "This is your actual customer base — not a follower count, not a mailing list you rented. Ten minutes here tells you who is buying repeatedly, who signed up and never ordered, and who is stuck at verification and needs a nudge.",
      notes: [
        "Total Customers and Active Customers show the same number today — there is no separate \"active\" rule yet, so read them as one figure.",
        "Export covers the page you are looking at, not the whole list. Set rows per page to 100 first if you want more in one file.",
        "Customers you have erased drop out of both the list and the counters. A handful of older erased records can still appear as \"Deleted User\" — they hold no personal data at all.",
        "No customers yet? The empty screen has a Copy Store URL button. That link is the one to share.",
      ],
    },
    {
      id: "record",
      kind: "editor",
      title: "One customer's page",
      shot: {
        id: "customer-detail",
        caption:
          "Everything you hold on one person: contact details on the left, tags, consent, and GDPR actions down the right.",
        alt: "A customer detail page showing customer information, order history, tags, marketing consent, and actions",
      },
      whatFor:
        "Press View on any row and you get one person on one page — their details, what they have bought, the labels you have given them, and what you may email them.",
      does: [
        "Customer Information holds first name, last name, email, phone, the date they became a customer, and when the record last changed. Edit makes those fields typeable; Save Changes writes them back.",
        "Changing the email address asks you to confirm first, then updates it in BudStacks, in the login system, and at Dr Green in one go. If any of the three doesn't take, you are told exactly which.",
        "Order History and Consultation History show this customer's totals; the orders themselves live in the Order Desk (Part 3).",
        "Down the right: Tags, Marketing Consent, and Actions — each covered in its own section below.",
      ],
      why:
        "When a customer emails you asking about their account, this page is the whole answer in one screen — no spreadsheets, no cross-checking, no guessing whether the person on the phone is the one in front of you.",
      notes: [
        "Medical answers are not shown here and are not kept by BudStacks. Health information belongs with the prescriber, not with the shop.",
        "Details captured during sign-up or the consultation form appear here even if nobody ever typed them into this page.",
      ],
    },
    {
      id: "tags",
      kind: "concept",
      title: "Tags",
      whatFor:
        "Tags are labels you invent — vip, wholesale, trade-show, slow-payer. There is no fixed set to learn and nothing to configure: you type a word and it exists.",
      does: [
        "Add a tag on the customer's page: type it into the Tags card and press Add. Remove one with the small x on the chip.",
        "Tags are stored trimmed and in lower case, so \"VIP\", \"vip\", and \" Vip \" are one tag rather than three. Up to 40 characters each.",
        "Adding the same tag to the same person twice does nothing — you cannot end up with duplicates.",
        "As soon as one tag exists, the tag dropdown appears on the customer list so you can pull up everyone carrying it.",
        "Segments in the Email Hub (Part 9) can use a tag as a rule, which turns a label into an audience you can write to.",
      ],
      walkthroughs: [
        {
          title: "Find and tag your VIPs",
          steps: [
            {
              text: "Open Customers and read down the Orders column — the people with several orders are the ones worth keeping.",
              note: "Long list? Set rows per page to 100, press Export, and sort by the Orders column in your spreadsheet.",
            },
            { text: "Press View on the first of them." },
            {
              text: "In the Tags card, type vip and press Add.",
              note: "You should see a green chip appear straight away. It is saved at that moment — there is nothing else to press.",
            },
            { text: "Go back to Customers and repeat for the rest of your regulars." },
            {
              text: "Now choose vip from the tag dropdown on the customer list.",
              note: "You should see only your tagged customers, and the heading change from All Customers to Results.",
            },
            {
              text: "In the Email Hub, build a segment with the rule \"has tag: vip\" and use it as a campaign audience.",
              note: "Tag someone new next month and they join that audience automatically — the segment is a rule, not a frozen list.",
            },
          ],
        },
      ],
      why:
        "Tags are the cheapest customer research you will ever do. Five minutes labelling your regulars turns an undifferentiated list into an audience you can speak to differently — and the label keeps working every time you write to them.",
      notes: [
        "Tags are yours and private to your store. Customers never see them.",
        "The Orders column can't be sorted from its heading yet — the export-and-sort route above is the way round it for now.",
      ],
    },
    {
      id: "consent",
      kind: "concept",
      title: "Marketing consent",
      whatFor:
        "Whether you may send this customer marketing. It is recorded as a moment in time — the date and minute consent was given — rather than a box that someone might have ticked at some point.",
      does: [
        "Consent is never assumed. Customers give it themselves: a tick at sign-up, on the consultation form, or at checkout. A new customer starts with none.",
        "The card reads either \"Consented on\" with the date and time, or \"No consent\".",
        "Record consent exists for opt-ins given away from the website — in writing, or in person at a counter. It asks you to confirm, because you are asserting something the customer did.",
        "Withdraw consent clears it immediately.",
        "If the customer unsubscribes from an email, consent is cleared automatically. They don't have to ask you, and you don't have to remember.",
        "Every change is written to the Paper Trail (Part 12): who changed it, when, and what it was before.",
        "Campaigns and segments only ever reach customers who have consent, so this card is the switch behind your whole email programme.",
      ],
      why:
        "Consent is the part of marketing that gets shops fined. Handled this way it is simply a date on a record, set by the customer, changed only deliberately, and evidenced automatically — so if anyone ever asks how you came to email someone, you have the answer rather than an argument.",
      notes: [
        "No consent does not mean no email. Order confirmations and shipping updates still send — those are service messages about something the customer bought, not marketing.",
        "Recording or withdrawing consent needs permission to edit customers (Part 13, The Team Room). Without it the change is refused rather than quietly ignored.",
        "Only record consent you can actually point to. The audit entry names you as the person who asserted it.",
      ],
    },
    {
      id: "data-requests",
      kind: "concept",
      title: "Data requests: export and erasure",
      whatFor:
        "The two things a customer is entitled to ask you for: a copy of what you hold about them, and deletion of it. Both are handled from these screens, and neither needs a developer.",
      does: [
        "Export, on the customer list, downloads what you hold as a spreadsheet: name, email, phone, order count, and join date.",
        "Delete Customer (GDPR), in the Actions card on their page, erases the person. Name, email, phone, and address are wiped, the login is unlinked, and the connection to their Dr Green medical profile is cut.",
        "It anonymises rather than deletes. The orders stay — with nobody's name on them — so your sales records, your accounts, and your tax position stay intact and defensible. Nothing you are obliged to keep disappears, and nothing personal remains.",
        "You are shown exactly that in the confirmation before anything happens, and the action is written to the Paper Trail (Part 12) afterwards.",
        "Running it twice is harmless — the second attempt changes nothing and still logs.",
        "If a customer deletes their own account instead of asking you, the identical erasure runs by itself.",
      ],
      walkthroughs: [
        {
          title: "Handle a data request",
          steps: [
            {
              text: "Search the customer list for the email address the request came from.",
              note: "Search by email, not by name. Two people can share a name; the address is what identifies an account.",
            },
            { text: "Press View and check the details on screen match the person who wrote to you." },
            {
              text: "If they asked for a copy of their data: their contact details are on this page, their orders are in the Order Desk (Part 3), and the customer list's Export gives you those fields as a spreadsheet you can send back.",
              note: "Say in your reply which systems the copy covers — your store, not the payment or prescribing providers behind it.",
            },
            {
              text: "If they asked to be deleted: press Delete Customer (GDPR) in the Actions card and read the confirmation.",
              note: "It tells you plainly what will happen — personal details anonymised, order history retained. That is the correct answer to an erasure request, not a compromise.",
            },
            {
              text: "Confirm. You are returned to the customer list and they are no longer on it.",
              note: "You should see the total drop by one. If you ever need to prove when it was done and by whom, it is in the Paper Trail.",
            },
          ],
        },
      ],
      why:
        "A data request arrives with a deadline attached, and the panic usually comes from not knowing where the data lives. It lives here. Both answers are a search and a button, and both leave a record that shows you answered properly.",
      notes: [
        "Erasure cannot be undone. There is no restore, by design — a deletion you could reverse would not be a deletion.",
        "It covers what BudStacks holds. Anything held by the providers behind your store — the login service, Dr Green — has to be requested from them directly.",
        "A full per-customer data file (profile, orders, consultations in one download) already exists in the platform and is audit-logged, but it has no button on this page yet. It is on the roadmap below.",
      ],
    },
  ],
  improvements: [
    "A one-click \"Download this customer's data\" file on the customer page.",
    "Sorting and filtering the customer list by order count and total spent.",
    "Order and consultation history listed in full on the customer page instead of counted.",
    "Lifetime value and last-order date shown on the customer record.",
  ],
};
