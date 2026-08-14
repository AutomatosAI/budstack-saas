"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

import {
  AI_CRAWLERS,
  AI_CRAWLER_CLASS_COPY,
  AI_CRAWLER_POLICY_NOTE,
  AI_CRAWLER_POLICY_OPTIONS,
  AI_CRAWLER_USER_TRIGGERED_NOTE,
  isAiCrawlerClassBlocked,
  type AiCrawlerPolicy,
} from "@/lib/seo/ai-crawlers";

/**
 * LLM Visibility US-001 — the AI Crawlers tab of the SEO Manager.
 *
 * THE COPY IS THE FEATURE. Owners arrive here believing "AI bots" is one thing;
 * it is two, and the expensive mistake — blocking the search class to protect
 * content from training — is the one this screen has to make impossible to make
 * by accident. So every class states what it does AND what refusing it costs
 * (`AI_CRAWLER_CLASS_COPY`), and the bot list shows which of the two each
 * user-agent belongs to, live against the chosen policy.
 *
 * NOTHING HERE PROMISES A CITATION. Allowing the search class is a
 * precondition, not a lever: it lets an engine read the store, and that is the
 * whole of the claim made on this screen.
 *
 * Rendered only for a tenant holding `seo.pro` (app/tenant-admin/seo/page.tsx);
 * a Basic tenant meets the locked card in the Pro tab instead. That is
 * PRESENTATION — the boundary is `requireFeature(FEATURES.SEO_PRO, …)` on the
 * PUT route, which 403s a Basic tenant whatever this component renders.
 */

const API_PATH = "/api/tenant-admin/seo/ai-crawlers";

const NETWORK_ERROR =
  "Could not reach the server. Check your connection and retry.";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface AiCrawlersTabProps {
  /**
   * Resolved server-side in page.tsx through `parseAiCrawlerPolicy`, so an
   * absent or unreadable stored value arrives as 'open' rather than as a blank
   * control.
   */
  initialPolicy: AiCrawlerPolicy;
  /** The store's robots.txt, so an owner can read what this actually published. */
  robotsUrl: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const { error } = (body ?? {}) as { error?: unknown };
    if (typeof error === "string" && error) return error;
  } catch {
    // Non-JSON body (a proxy error page, an empty 500) — fall through.
  }
  return "Could not save that setting. Try again.";
}

export function AiCrawlersTab({
  initialPolicy,
  robotsUrl,
}: AiCrawlersTabProps) {
  // The SAVED value, not the selected one: the bot list below must describe what
  // the storefront is publishing right now, so it only moves once a write lands.
  const [policy, setPolicy] = useState<AiCrawlerPolicy>(initialPolicy);
  const [selected, setSelected] = useState<AiCrawlerPolicy>(initialPolicy);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || selected === policy) return;

    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const response = await fetch(API_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiCrawlerPolicy: selected }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const body: { aiCrawlerPolicy?: AiCrawlerPolicy } = await response.json();
      // The stored value wins over the selection — it is what robots.txt renders.
      const stored = body.aiCrawlerPolicy ?? selected;
      setPolicy(stored);
      setSelected(stored);
      setSaved(true);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bs-card bs-card-pad space-y-6">
      <div>
        <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
          AI crawlers
        </h3>
        <p className="text-sm text-bs-fg-muted max-w-[720px]">
          Every AI company runs two different bots: one that reads your pages to
          answer a question someone is asking right now, and one that collects
          pages to train a future model. They are separate, and blocking one does
          nothing to the other — turning away{" "}
          <span className="font-mono text-xs">GPTBot</span> does not remove you
          from ChatGPT&apos;s answers, because that is{" "}
          <span className="font-mono text-xs">OAI-SearchBot</span>.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <fieldset className="space-y-2.5">
          <legend className="text-xs font-medium text-bs-fg-muted mb-2">
            What this store publishes
          </legend>
          {AI_CRAWLER_POLICY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-2.5 rounded-bs-md border p-3 ${
                selected === option.value
                  ? "border-bs-green/40 bg-bs-green/10"
                  : "border-bs-border-100"
              }`}
            >
              <input
                type="radio"
                name="ai-crawler-policy"
                value={option.value}
                checked={selected === option.value}
                onChange={() => {
                  setSaved(false);
                  setError(null);
                  setSelected(option.value);
                }}
                className="mt-0.5"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-bs-fg">
                  {option.label}
                </span>
                <span className="block text-xs text-bs-fg-muted">
                  {option.summary}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bs-btn bs-btn-green bs-btn-sm"
            disabled={saving || selected === policy}
          >
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Save
          </button>
          {saved && !saving && (
            <span className="inline-flex items-center gap-1 text-sm text-bs-fg-muted">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              Saved
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm text-bs-danger" role="alert">
            {error}
          </p>
        )}
      </form>

      {/* What each class is worth, and what refusing it costs. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AI_CRAWLER_CLASS_COPY.map((copy) => {
          const blocked = isAiCrawlerClassBlocked(policy, copy.crawlerClass);
          return (
            <div
              key={copy.crawlerClass}
              className="rounded-bs-md border border-bs-border-100 p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-bs-fg">{copy.label}</h4>
                <span
                  className={`bs-chip ${blocked ? "bs-chip-gold" : ""}`}
                  data-crawler-class-state={blocked ? "blocked" : "allowed"}
                >
                  {blocked ? "Refused" : "Allowed"}
                </span>
              </div>
              <p className="text-xs text-bs-fg-muted">{copy.benefit}</p>
              <p className="text-xs text-bs-fg-muted">{copy.cost}</p>
              <ul className="pt-1 space-y-1">
                {AI_CRAWLERS.filter(
                  (crawler) => crawler.crawlerClass === copy.crawlerClass,
                ).map((crawler) => (
                  <li key={crawler.userAgent} className="text-xs">
                    <span className="font-mono text-bs-fg">
                      {crawler.userAgent}
                    </span>{" "}
                    <span className="text-bs-fg-muted">— {crawler.owner}</span>
                    <span className="block text-bs-fg-muted">
                      {crawler.purpose}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 text-xs text-bs-fg-muted">
        <p>{AI_CRAWLER_POLICY_NOTE}</p>
        <p>{AI_CRAWLER_USER_TRIGGERED_NOTE}</p>
        <p>
          Saved changes take effect on the next request — read what your store
          publishes at{" "}
          <a
            href={robotsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-bs-fg break-all"
          >
            {robotsUrl}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
