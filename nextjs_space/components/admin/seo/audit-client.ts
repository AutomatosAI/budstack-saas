/**
 * SEO Supercharge US-023 — the browser half of the audit panel: fetch it, and
 * refuse to render anything we cannot read.
 *
 * SPLIT OUT OF THE COMPONENT so the parsing and the error mapping are unit
 * testable — this repo has no React-rendering test setup, so a fetch buried in a
 * `useEffect` is a fetch nothing ever asserts on. Same device as the email
 * run's `email-settings-client.ts`.
 *
 * FAILS CLOSED ON THE BODY. The response is our own JSON, but a proxy error
 * page, a stale deploy or a 500 rendered as HTML all arrive here as "not what
 * the type says", and a component that trusts the shape crashes with no
 * `error.tsx` above it. Anything unreadable becomes an error state carrying a
 * sentence, never a half-rendered panel.
 *
 * Dependency-free on purpose (no zod, no next): it is imported by a client
 * component, like every other pure module the SEO Manager reaches for.
 */

import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/plan";
import {
  SEO_AUDIT_CHECKS,
  SEO_AUDIT_TABS,
  type SeoAuditCheckResult,
  type SeoAuditFinding,
  type SeoAuditGrade,
  type SeoAuditResult,
  type SeoAuditSeverity,
  type SeoAuditStats,
  type SeoAuditTab,
} from "@/lib/seo/audit-types";
import type { SeoAuditSnapshot } from "@/lib/seo/audit-cache";

export const SEO_AUDIT_API_PATH = "/api/tenant-admin/seo/audit";

const UNREADABLE =
  "The audit came back in a form this page could not read. Try again in a moment.";
const NETWORK_ERROR =
  "Could not reach the server. Check your connection and retry.";

export type SeoAuditFetchOutcome =
  | { readonly ok: true; readonly snapshot: SeoAuditSnapshot }
  | {
      readonly ok: false;
      readonly error: string;
      /** True for the plan gate's 403 — the panel offers an upgrade, not a retry. */
      readonly upgradeRequired: boolean;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * US-004 — a finding's `href` is rendered straight into a link, so only a path
 * INSIDE this admin survives the parse: one leading slash and no second one.
 * `//evil.example` is a protocol-relative URL a browser resolves off-site, and
 * an audit finding is the last place a store owner would expect to leave the
 * panel. Anything else is dropped and the finding falls back to its tab.
 */
function parseHref(value: unknown): string | null {
  const href = str(value);
  return href.startsWith("/") && !href.startsWith("//") ? href : null;
}

function parseTarget(value: unknown): SeoAuditFinding["target"] | null {
  if (!isRecord(value)) return null;
  const tab = str(value.tab);
  if (!SEO_AUDIT_TABS.includes(tab as SeoAuditTab)) return null;
  const entityId = str(value.entityId);
  const href = parseHref(value.href);
  return {
    tab: tab as SeoAuditTab,
    ...(entityId ? { entityId } : {}),
    label: str(value.label),
    ...(href ? { href } : {}),
  };
}

function parseFindings(value: unknown): SeoAuditFinding[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const target = parseTarget(item.target);
    const message = str(item.message);
    if (!target || !message) return [];
    return [
      {
        check: item.check as SeoAuditFinding["check"],
        severity: str(item.severity) as SeoAuditSeverity,
        message,
        target,
      },
    ];
  });
}

function parseChecks(value: unknown): SeoAuditCheckResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const check = str(item.check);
    // An unknown check id means this page is older than the API that answered
    // it. Dropping the group is the honest degrade: the score still adds up,
    // and the owner is not shown a heading with no meaning.
    if (!SEO_AUDIT_CHECKS.includes(check as SeoAuditCheckResult["check"])) {
      return [];
    }
    return [
      {
        check: check as SeoAuditCheckResult["check"],
        severity: str(item.severity) as SeoAuditSeverity,
        title: str(item.title),
        total: num(item.total),
        findings: parseFindings(item.findings),
        penalty: num(item.penalty),
      },
    ];
  });
}

function parseStats(value: unknown): SeoAuditStats {
  const record = isRecord(value) ? value : {};
  return {
    pages: num(record.pages),
    products: num(record.products),
    posts: num(record.posts),
    conditions: num(record.conditions),
    redirects: num(record.redirects),
    sitemapEntries: num(record.sitemapEntries),
    truncated: Array.isArray(record.truncated)
      ? record.truncated.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

/** The audit result, or null when the body is not one. */
export function parseSeoAuditSnapshot(body: unknown): SeoAuditSnapshot | null {
  if (!isRecord(body) || !isRecord(body.audit)) return null;
  const audit = body.audit;
  if (typeof audit.score !== "number" || !Array.isArray(audit.checks)) {
    return null;
  }

  const severityCounts = isRecord(audit.severityCounts)
    ? audit.severityCounts
    : {};

  const result: SeoAuditResult = {
    score: Math.max(0, Math.min(100, Math.round(num(audit.score)))),
    grade: str(audit.grade) as SeoAuditGrade,
    checks: parseChecks(audit.checks),
    totalFindings: num(audit.totalFindings),
    severityCounts: {
      critical: num(severityCounts.critical),
      warning: num(severityCounts.warning),
      info: num(severityCounts.info),
    },
    stats: parseStats(audit.stats),
  };

  return {
    audit: result,
    generatedAt: str(body.generatedAt),
    cached: body.cached === true,
    expiresIn: num(body.expiresIn),
  };
}

/**
 * The server's own sentence, and whether the refusal was about the PLAN.
 *
 * The body is read once, because it can only be read once. `upgrade_required`
 * is what `requireFeature` returns and a permission 403 does not carry it — the
 * difference is the difference between "buy the plan" and "ask your admin", and
 * offering the wrong one sends somebody to the wrong place.
 */
async function refusal(
  response: Response,
  fallback: string,
): Promise<{ error: string; upgradeRequired: boolean }> {
  try {
    const body: unknown = await response.json();
    const record = isRecord(body) ? body : {};
    const message = str(record.error);
    return {
      error: message || fallback,
      upgradeRequired: record.code === UPGRADE_REQUIRED_CODE,
    };
  } catch {
    // Non-JSON body (a proxy error page, an empty 500).
    return { error: fallback, upgradeRequired: false };
  }
}

/**
 * Run the audit.
 *
 * `refresh` bypasses the server's 15-minute cache — what the Re-run button
 * sends, so an owner who has just fixed three findings sees the new score
 * instead of the old one.
 */
export async function fetchSeoAudit(
  options: { readonly refresh?: boolean } = {},
): Promise<SeoAuditFetchOutcome> {
  let response: Response;
  try {
    response = await fetch(
      options.refresh ? `${SEO_AUDIT_API_PATH}?refresh=1` : SEO_AUDIT_API_PATH,
      { headers: { accept: "application/json" } },
    );
  } catch {
    return { ok: false, error: NETWORK_ERROR, upgradeRequired: false };
  }

  if (!response.ok) {
    const { error, upgradeRequired } = await refusal(
      response,
      "Could not run the SEO audit.",
    );
    return { ok: false, error, upgradeRequired };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: UNREADABLE, upgradeRequired: false };
  }

  const snapshot = parseSeoAuditSnapshot(body);
  return snapshot
    ? { ok: true, snapshot }
    : { ok: false, error: UNREADABLE, upgradeRequired: false };
}
