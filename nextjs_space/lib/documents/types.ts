/**
 * The BudStacks Guide — content model.
 *
 * Guides are DATA. Writers fill one module per admin tab under
 * `lib/documents/guides/`; `app/documents/` owns every pixel of layout.
 * Nothing here imports React, Next, or Prisma — a guide module must stay
 * importable anywhere (renderer, sitemap, future search index, future
 * chatbot knowledge export).
 *
 * Screenshots are referenced by id — the file must exist at
 * `public/documents/shots/{id}.jpg` (produced by scripts/docs-shots/).
 */

export type GuideStep = {
  text: string;
  /** Optional aside shown under the step — a tip, a caveat, a "you should see". */
  note?: string;
};

/** An embedded guide video — YouTube id only (privacy-enhanced host). */
export type GuideVideo = {
  youtubeId: string;
  title: string;
};

export type GuideWalkthrough = {
  /** Task-shaped title, e.g. "Send your first newsletter". */
  title: string;
  steps: GuideStep[];
  /** Optional real-UI walkthrough recording for this task. */
  video?: GuideVideo;
};

export type GuideShot = {
  /** Filename stem under public/documents/shots/ (no extension). */
  id: string;
  caption: string;
  alt: string;
};

export type GuideSection = {
  /** Stable anchor id, kebab-case. */
  id: string;
  /** What this section documents — a tab, an editor/dialog, or a concept. */
  kind: "tab" | "editor" | "concept";
  title: string;
  /** True when the feature is Pro-plan gated (renders the Pro chip). */
  pro?: boolean;
  shot?: GuideShot;
  /** 1–2 sentences: what this screen is for, in the owner's language. */
  whatFor: string;
  /** Feature bullets — what it does. Plain language, no jargon. */
  does: string[];
  /** Optional task walkthroughs — the step-by-step heart of the guide. */
  walkthroughs?: GuideWalkthrough[];
  /** The business benefit — why an owner should care. One short paragraph. */
  why: string;
  /** Honest caveats, tips, and "don't worry about X" notes. */
  notes?: string[];
};

export type GuideStatus = "published" | "coming-soon";

export type Guide = {
  /** URL slug under /documents/. */
  slug: string;
  /** Part number in the series (sidebar order). */
  part: number;
  /** Page title — a name, e.g. "The Email Hub". */
  title: string;
  /** Short sidebar label, usually the admin tab's own name. */
  navLabel: string;
  /** The admin path this guide documents, e.g. "/tenant-admin/emails". */
  adminPath: string;
  /** 1–2 sentence summary shown on the index and under the title. */
  summary: string;
  status: GuideStatus;
  /** Optional section overview video, shown under the guide header. */
  video?: GuideVideo;
  sections: GuideSection[];
  /** Known gaps / planned improvements — rendered as a discreet footer list. */
  improvements?: string[];
  /** ISO date of last content update. */
  updatedAt: string;
};
