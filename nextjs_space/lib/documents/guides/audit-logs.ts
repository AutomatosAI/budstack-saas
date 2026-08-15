import type { Guide } from "../types";

/**
 * Part 12 — The Paper Trail. Written for a non-technical store owner, in the
 * shape the exemplar (emails.ts) sets. Every claim matches
 * app/tenant-admin/audit-logs/page.tsx, its API route, and lib/audit-log.ts
 * (redaction, immutability, PRD-302 impersonation attribution).
 */
export const audit_logsGuide: Guide = {
  slug: "audit-logs",
  part: 12,
  title: "The Paper Trail",
  navLabel: "Audit Logs",
  adminPath: "/tenant-admin/audit-logs",
  summary:
    "A record of every action taken in your store admin — who did what, when.",
  status: "published",
  updatedAt: "2026-08-15",
  sections: [
    {
      id: "activity-log",
      kind: "tab",
      title: "Activity Log",
      shot: {
        id: "audit-logs",
        caption:
          "Newest first: the time, the action as a coloured pill, what it happened to, and who did it.",
        alt: "The Audit Logs page showing the total event count, two filters and the activity table",
      },
      whatFor:
        "The record of what has been done inside your admin. Every change anybody makes writes a line here — the time, the action, what it was done to, the account that did it and the address they did it from.",
      does: [
        "Newest first, fifty to a page, with the running total above the table and page controls beneath it.",
        "Each row: the time to the second, the action as a colour-coded pill, the kind of thing it happened to, the person's email, their IP address, and the recorded details.",
        "The colours are a shortcut, not a judgement. Green is something created or a sign-in, red is something deleted or a failure, blue is something changed, amber is a warning, grey is everything else.",
        "Two filters: one for the action, one for the kind of thing it happened to. Both reload the list on the spot, and the total above the table follows the filter.",
        "Far more is recorded than the two filter lists offer. Settings changes, team invitations and removals, role changes, webhook changes, customer privacy actions and SEO changes are all in the list — they simply cannot be picked from the dropdowns.",
        "Personal details are stripped out before a row is written, so the details column shows field names and references rather than customers' names and addresses.",
        "Rows are written once and never changed or removed by the admin. That is the point of the record.",
      ],
      walkthroughs: [
        {
          title: "Answer “who changed this?”",
          steps: [
            {
              text: "Open Audit Logs in the left menu. You land on the most recent events, newest at the top.",
            },
            {
              text: "Narrow it with the second dropdown — pick the kind of thing you are asking about, such as Branding.",
              note: "The list reloads immediately, and the count above the table now counts only the rows that match.",
            },
            {
              text: "Read down the Timestamp column to the day the change happened.",
              note: "On a narrow screen the table hides the user, IP and details columns to fit. Widen the window, or turn a tablet sideways, to see the whole row.",
            },
            {
              text: "Read the User column. That is the account that did it.",
              note: "“System” is not a person — it means the platform did it: a scheduled job, or an incoming notification from Dr Green.",
            },
            {
              text: "Read the Details column on that row for the specifics of what changed.",
              note: "If a filter is not finding it, clear both dropdowns and page back through the list. The dropdowns only cover a handful of actions, so plenty of real events are only findable by looking.",
            },
          ],
        },
      ],
      why:
        "The moment more than one person can open your admin, “who changed the price?” stops being a rhetorical question. This screen turns it into a ten-second lookup with a timestamp against it, which ends the conversation before it becomes an argument. It is also the record you reach for when something needs explaining after the fact — a price that moved, a customer record that was erased, a setting that stopped working on a particular afternoon.",
      notes: [
        "There is no search box today. Two dropdown filters and the page buttons are the whole toolkit, so a specific event from months ago takes some paging.",
        "The action dropdown covers six actions and the entity dropdown four kinds of thing. Everything else — team, settings, email, SEO, privacy — is recorded and shown, just not filterable.",
        "The details are deliberately thin on personal data. Names, emails, phone numbers and addresses are stripped before the row is stored, so this record cannot itself become a privacy problem.",
        "The menu item only appears for roles you have granted View audit logs in Roles & permissions.",
        "When BudStacks support works inside your store with your permission, their actions are recorded under their own account and tied to that support session. It is never disguised as one of your staff.",
        "Rows are kept indefinitely. There is no way to clear them or set a retention period from this screen, which is intentional for a record whose value comes from being complete.",
      ],
    },
  ],
  improvements: [
    "A search box — by person, by reference, or by free text across the details.",
    "Filter lists that cover everything actually recorded, rather than the six actions and four entity types offered today.",
    "A date range picker, so “what happened last Tuesday” does not mean paging back through fifty rows at a time.",
    "Exporting a filtered view, for handing to an accountant or an auditor.",
    "A retention setting for stores that would rather not keep everything forever.",
  ],
};
