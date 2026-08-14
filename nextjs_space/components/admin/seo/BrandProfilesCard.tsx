"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

import {
  SOCIAL_LINKS_MAX,
  SOCIAL_LINK_MAX_LENGTH,
  checkSocialLinks,
} from "@/lib/seo/social-links";

/**
 * LLM Visibility US-006 — the profiles this store publishes as its own.
 *
 * ONE TEXTAREA, ONE URL PER LINE, rather than a row of named platform fields.
 * Named fields decide in advance which platforms count, and the list a store
 * actually needs is not four social networks — it is whichever of Instagram, a
 * Companies House page, a Trustpilot profile and a parent company's site the
 * owner can stand behind. `sameAs` treats them all identically, so the field
 * does too.
 *
 * THE COPY STATES THE LIMIT OF THE CLAIM. This connects the store's entity to
 * accounts an engine may already know about; it does not make anything rank or
 * get cited, and the card says so rather than letting the SEO Manager imply it.
 *
 * Validation runs HERE through the same `checkSocialLinks` the route enforces,
 * so a mistyped line is named before the round trip; the server's own message is
 * still shown verbatim when one comes back, since it is the authority and the
 * two could differ after a deploy.
 *
 * Rendered only for a tenant holding `seo.pro` (app/tenant-admin/seo/page.tsx);
 * a Basic tenant meets the locked card in the Pro tab instead. That is
 * PRESENTATION — the boundary is `requireFeature(FEATURES.SEO_PRO, …)` on the
 * PUT route, which 403s a Basic tenant whatever this component renders.
 */

const API_PATH = "/api/tenant-admin/seo/social-links";

const NETWORK_ERROR =
  "Could not reach the server. Check your connection and retry.";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

/**
 * Room for the full list plus the newlines between the lines. The per-line cap
 * is what the route enforces; this only stops a paste of a whole document.
 */
const TEXTAREA_MAX_LENGTH =
  SOCIAL_LINKS_MAX * (SOCIAL_LINK_MAX_LENGTH + 1);

interface BrandProfilesCardProps {
  /**
   * The stored list, resolved server-side in page.tsx through
   * `readSocialLinks`, so what the field shows is what the storefront publishes
   * rather than a second reading of the settings blob.
   */
  initialLinks: readonly string[];
}

/** One URL per line, empties dropped — what the owner typed becomes a list. */
function toLinks(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const { error } = (body ?? {}) as { error?: unknown };
    if (typeof error === "string" && error) return error;
  } catch {
    // Non-JSON body (a proxy error page, an empty 500) — fall through.
  }
  return "Could not save those links. Try again.";
}

export function BrandProfilesCard({ initialLinks }: BrandProfilesCardProps) {
  const [text, setText] = useState(initialLinks.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setError(null);
    setSaved(false);

    const checked = checkSocialLinks(toLinks(text));
    if (!checked.ok) {
      setError(checked.message);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(API_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialLinks: checked.value }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const body: { socialLinks?: string[] } = await response.json();
      // The stored list wins over what was typed: the route trims and drops
      // repeats, and the field should show what the storefront will publish.
      if (Array.isArray(body.socialLinks)) setText(body.socialLinks.join("\n"));
      setSaved(true);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bs-card bs-card-pad space-y-4">
      <div>
        <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
          Your profiles elsewhere
        </h3>
        <p className="text-sm text-bs-fg-muted max-w-[720px]">
          Your store&apos;s pages already say what this business is called and
          where it lives. Nothing in them says the Instagram account, the
          LinkedIn page and the company register entry with the same name are
          the same business. These links are that statement — search engines and
          AI answer engines read them to join the records up.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <label
          htmlFor="brand-profiles"
          className="block text-xs font-medium text-bs-fg-muted"
        >
          One address per line, up to {SOCIAL_LINKS_MAX}
        </label>
        <textarea
          id="brand-profiles"
          value={text}
          onChange={(event) => {
            setSaved(false);
            setError(null);
            setText(event.target.value);
          }}
          rows={6}
          maxLength={TEXTAREA_MAX_LENGTH}
          placeholder={
            "https://www.instagram.com/yourstore\nhttps://www.linkedin.com/company/yourstore"
          }
          className="bs-input font-mono text-sm w-full resize-y py-2"
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bs-btn bs-btn-green bs-btn-sm"
            disabled={saving}
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

      <div className="space-y-2 text-xs text-bs-fg-muted">
        <p>
          List only accounts you control. This is a claim that they are you, and
          an engine that follows one to a page which never mentions this store
          learns the opposite of what you meant.
        </p>
        <p>
          It is not a ranking lever and it will not get your store cited. It
          removes an ambiguity — an engine that has already found both records
          can tell they are one business rather than two.
        </p>
        <p>
          Addresses must start with{" "}
          <span className="font-mono">https://</span>. Saved changes appear in
          your store&apos;s structured data on the next request.
        </p>
      </div>
    </section>
  );
}
