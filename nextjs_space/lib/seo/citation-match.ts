/**
 * LLM Visibility US-005 — did this answer actually link to the store?
 *
 * THE MATCH IS A HOST MATCH, and only a host match. A model that says "Green
 * Leaf Clinic is a good option" has not cited anybody — half the stores in a
 * market share words with each other, and a monitor that counted name mentions
 * would report citations a store cannot verify by clicking. A URL whose host is
 * the store's is checkable, which is the only claim this feature makes.
 *
 * BOTH HOSTS COUNT. A store with a custom domain serves the identical catalogue
 * on `{subdomain}.budstacks.io` too (`lib/seo/canonical.ts` explains the
 * duplicate-content problem that creates), and a model that found the platform
 * host has still found the store. Both are matched; the URL as written is what
 * gets recorded, so an owner sees which one was linked.
 *
 * Pure and total: no prisma, no next, no env beyond what `getTenantBaseUrl`
 * already resolves. Everything arrives as a string and nothing here throws —
 * the caller is a worker holding a model's free text, which can be anything.
 */

import { CITATION_MENTION_MAX_CHARS } from "@/lib/seo/citation-monitor";
import { getTenantBaseUrl, type TenantUrlData } from "@/lib/tenant/tenant-utils";

/** Longest URL kept as evidence. Past this it is not a link, it is a payload. */
const CITED_URL_MAX_CHARS = 500;

/**
 * Scheme optional, `www.` optional, path optional — the three forms a model
 * writes a URL in ("https://shop.example.com/products/x", "www.example.com",
 * "example.com/products"). The host must have at least one dot, which is what
 * keeps ordinary prose ("in the U.S.") from parsing as a hostname.
 *
 * Trailing sentence punctuation is deliberately allowed INTO the match and
 * trimmed off afterwards ({@link trimTrailingPunctuation}) — a model ends
 * sentences with a URL constantly, and a regex that excluded `.` from the path
 * would also lose "/products/blue-dream." mid-path.
 */
const URL_LIKE =
  /(https?:\/\/)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(\/[^\s<>()[\]{}"'`]*)?/gi;

/** Punctuation a sentence ends with, never part of the URL that preceded it. */
function trimTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)\]}'"`>]+$/, "");
}

/**
 * A host as it compares: lower-cased, `www.` dropped, port dropped, trailing
 * dot dropped. `WWW.Example.com:443` and `example.com.` are the same store.
 */
export function normaliseCitationHost(value: string): string {
  const host = value.trim().toLowerCase();
  const withoutPort = host.split(":")[0];
  const withoutTrailingDot = withoutPort.replace(/\.$/, "");
  return withoutTrailingDot.startsWith("www.")
    ? withoutTrailingDot.slice(4)
    : withoutTrailingDot;
}

/**
 * Every host that IS this store.
 *
 * The platform host comes from `getTenantBaseUrl` rather than being rebuilt
 * here, so the monitor looks for exactly the host the store's canonicals,
 * sitemap and llms.txt advertise. A custom domain adds a second entry; it never
 * replaces the first, because the platform host keeps serving the store.
 */
export function citationHosts(tenant: TenantUrlData): readonly string[] {
  const hosts = new Set<string>();

  const platformHost = `${tenant.subdomain}.${
    process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io"
  }`;
  hosts.add(normaliseCitationHost(platformHost));

  if (tenant.customDomain) {
    hosts.add(normaliseCitationHost(tenant.customDomain));
  }

  // Belt and braces: whatever the shared helper calls primary is a host this
  // store answers on, even if the two rules above ever drift.
  try {
    hosts.add(normaliseCitationHost(new URL(getTenantBaseUrl(tenant)).hostname));
  } catch {
    // getTenantBaseUrl is total, but a stored domain with a space in it would
    // still fail to parse — the two explicit hosts above stand on their own.
  }

  return [...hosts].filter((host) => host.length > 0);
}

export interface CitationMatch {
  readonly cited: boolean;
  /** The URL as the model wrote it, trimmed of sentence punctuation. */
  readonly citedUrl: string | null;
  /** The sentence-ish window around it — the evidence an owner reads. */
  readonly mentionText: string | null;
}

const NO_MATCH: CitationMatch = {
  cited: false,
  citedUrl: null,
  mentionText: null,
};

/**
 * The text around `index`, clipped to a readable window and marked where it was
 * cut. Word boundaries are respected on both ends so the evidence never starts
 * or ends mid-word.
 */
function mentionAround(answer: string, index: number, length: number): string {
  const padding = Math.max(
    0,
    Math.floor((CITATION_MENTION_MAX_CHARS - length) / 2),
  );
  let start = Math.max(0, index - padding);
  let end = Math.min(answer.length, index + length + padding);

  if (start > 0) {
    const boundary = answer.indexOf(" ", start);
    if (boundary >= 0 && boundary < index) start = boundary + 1;
  }
  if (end < answer.length) {
    const boundary = answer.lastIndexOf(" ", end);
    if (boundary > index + length) end = boundary;
  }

  const snippet = answer.slice(start, end).replace(/\s+/g, " ").trim();
  const prefix = start > 0 ? "…" : "";
  const suffix = end < answer.length ? "…" : "";
  return `${prefix}${snippet}${suffix}`.slice(0, CITATION_MENTION_MAX_CHARS);
}

/**
 * Find the first URL in `answer` whose host is one of `hosts`.
 *
 * FIRST, not best: a model that links the store three times has cited it once
 * as far as this feature is concerned, and the first link is the one in the
 * sentence that made the recommendation. `cited: false` is a real answer, not
 * an error — most checks will return it, and a run that recorded nothing when
 * the store was not mentioned would lose exactly the baseline the dashboard's
 * trend is measured against.
 */
export function findCitation(
  answer: string,
  hosts: readonly string[],
): CitationMatch {
  if (!answer || hosts.length === 0) return NO_MATCH;

  const wanted = new Set(hosts.map(normaliseCitationHost));
  wanted.delete("");
  if (wanted.size === 0) return NO_MATCH;

  // A fresh regex per call: /g carries lastIndex, and a module-level one shared
  // between two answers would start the second scan wherever the first stopped.
  const pattern = new RegExp(URL_LIKE.source, "gi");

  for (
    let match = pattern.exec(answer);
    match !== null;
    match = pattern.exec(answer)
  ) {
    const host = normaliseCitationHost(match[2] ?? "");
    if (!wanted.has(host)) continue;

    const raw = trimTrailingPunctuation(match[0]).slice(0, CITED_URL_MAX_CHARS);
    if (!raw) continue;

    return {
      cited: true,
      citedUrl: raw,
      mentionText: mentionAround(answer, match.index, raw.length),
    };
  }

  return NO_MATCH;
}
