import type { Guide } from "../types";

/**
 * Part 10 — The Wire. Written for a non-technical store owner; every claim
 * below matches the shipped behaviour in app/tenant-admin/the-wire/.
 */
export const the_wireGuide: Guide = {
  slug: "the-wire",
  part: 10,
  title: "The Wire",
  navLabel: "The Wire",
  adminPath: "/tenant-admin/the-wire",
  summary:
    "Your store's own news channel — articles that inform customers and feed your search presence.",
  status: "published",
  updatedAt: "2026-08-15",
  sections: [
    {
      id: "posts",
      kind: "tab",
      title: "Your articles",
      shot: {
        id: "the-wire",
        caption:
          "Every article you have written, newest first — published and draft side by side.",
        alt: "The Wire article list showing published and draft articles with their row actions",
      },
      whatFor:
        "The page you work from. Everything your store has written lives here, and the four icons on each row cover almost everything you will ever do to an article.",
      does: [
        "Each row shows the title, the web address the article lives at, whether it is Published or a Draft, who wrote it, and when.",
        "The eye icon publishes and unpublishes in one click — no re-opening, no re-saving. Unpublishing takes the article off your site straight away and keeps it here as a draft.",
        "The pencil opens the article in the editor. The bin deletes it, after a confirmation.",
        "The envelope, on a published article, turns it into a newsletter draft — the walkthrough below.",
        "Articles produced in assisted mode arrive here carrying an Automatos label, as drafts, for you to read before anything goes live.",
      ],
      walkthroughs: [
        {
          title: "Turn an article into a newsletter",
          steps: [
            {
              text: "Find a published article and click the envelope icon on its row.",
              note: "The icon only appears on published articles — the email links to the live page, so there has to be a live page.",
            },
            {
              text: "Wait a moment. You should see “Newsletter draft created”, and you land in the email composer with the article already laid out as an email.",
            },
            {
              text: "Read it through. The cover image, headings and text come across; a Read more button at the bottom points back at the article on your site.",
              note: "Anything an inbox cannot show — an embedded video, for instance — is left behind on the way in. That is why you review before sending.",
            },
            {
              text: "Choose your audience, press Send test, then send. This is all covered in Part 9, The Email Hub.",
              note: "Nothing was sent by clicking the envelope. It only ever creates a draft — the send is still your decision, made in the composer.",
            },
          ],
        },
      ],
      why:
        "One piece of writing, two audiences: the people who find you on Google months from now, and the customers sitting in your list today. Writing it twice is the only version of this that costs you anything.",
      notes: [
        "No envelope on your rows? The newsletter action belongs to email permissions, not article permissions — a store owner can grant it in Part 13, The Team Room.",
        "Unpublishing is not deleting. The article comes straight back with the eye icon, exactly as you left it.",
      ],
    },
    {
      id: "editor",
      kind: "editor",
      title: "Writing an article",
      shot: {
        id: "the-wire-new",
        caption:
          "The article editor — title, summary, cover image, and the body written like a document.",
        alt: "The Wire article editor with title, excerpt, cover image and rich text fields",
      },
      whatFor:
        "Where an article gets written. The body works like a word processor — headings, bold, lists, links and images from a toolbar — and the fields around it decide how the article looks when someone shares it or finds it.",
      does: [
        "A title and a body are all that is required. Everything else makes the article work harder.",
        "Excerpt is the one- or two-sentence summary shown on article cards and previews.",
        "Cover Image takes a file you upload or a web address you paste, and shows you the picture before you save.",
        "Cover Image Alt Text describes that picture for screen readers and for image search. Leave it empty and the article title is used instead.",
        "Publish Status decides what saving does: put the article live, or keep it as a draft.",
        "Article URL — on an article that already exists — lets you change the address it lives at. Read the note below before you do.",
        "On Pro, with Automatos AI connected, a Generate button drafts the alt text for a saved article so you have something to edit rather than a blank box.",
      ],
      walkthroughs: [
        {
          title: "Publish your first article",
          steps: [
            { text: "On The Wire, press New Article." },
            {
              text: "Give it a title, then write the body underneath. The toolbar has headings, lists, links and images.",
              note: "Write the piece you would want to read as a customer — what a strain is for, how the consultation works, what changed in the law this month.",
            },
            {
              text: "Fill in the excerpt: one or two sentences that make someone want to open it.",
              note: "This is the text on the article card, so write it for a reader, not for a search engine.",
            },
            {
              text: "Add a cover image, then describe it in the alt text box that appears under it.",
            },
            {
              text: "Turn Publish Status on and press Create Article.",
              note: "You should land back on The Wire with your article at the top of the list and a green Published pill. It is live on your site now, at /the-wire/ followed by its web address.",
            },
          ],
        },
      ],
      why:
        "Product pages answer “what do you sell”. Articles answer “why should I trust you” — and they are the pages that bring people who have never heard of your shop in from a search.",
      notes: [
        "Renaming an article's web address moves the article. On Pro, saving points the old address at the new one automatically, so existing links and search rankings follow it; the editor tells you which of those two things is about to happen before you save. On Basic the old address stops working, and you can add the redirect yourself in Part 7, The SEO Manager, under Redirects.",
        "The URL box only appears on an article that already exists. A brand-new one takes its address from its title, because there is no old link to protect yet.",
        "Images you upload are stored permanently. An article you wrote a year ago will still have its pictures.",
      ],
    },
    {
      id: "wire-mode",
      kind: "concept",
      title: "Assisted drafts",
      pro: true,
      whatFor:
        "The switch at the top of The Wire. Manual means the only articles here are the ones you write. Assisted lets Automatos AI deliver draft articles for your store, which arrive in the same list for you to review.",
      does: [
        "Two settings, one switch. Every store starts on Manual.",
        "In Assisted mode, drafts appear in your article list carrying an Automatos label.",
        "Nothing written for you goes live on its own. A draft stays a draft until you read it, edit it in your own voice, and publish it.",
        "Switching back to Manual stops new drafts arriving. Anything already written stays in your list.",
        "The switch is part of the Pro plan. On Basic it shows a Pro label and stays off.",
      ],
      why:
        "The reason most storefronts have three articles and then stop is that the blank page wins. Having a draft waiting turns writing into editing, which is a job an owner can actually do between orders.",
      notes: [
        "The label on the row is there for you, not for customers — it never appears on the published article.",
      ],
    },
  ],
  improvements: [
    "Scheduled publishing — today an article goes live the moment you switch Publish on.",
    "Categories and tags, so a store with fifty articles can group them.",
  ],
};
