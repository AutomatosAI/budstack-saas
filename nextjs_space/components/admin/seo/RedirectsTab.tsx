"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import {
  SEO_REDIRECT_DEFAULT_STATUS,
  SEO_REDIRECT_MAX_PATH_LENGTH,
  SEO_REDIRECT_MAX_PER_TENANT,
  SEO_REDIRECT_STATUS_CODES,
  type SeoRedirectStatusCode,
} from "@/lib/seo/redirects";
import { RedirectRowItem, type RedirectRow } from "./RedirectRowItem";

/**
 * SEO Supercharge US-020 — the redirects tab of the SEO Manager.
 *
 * Rendered only for a tenant holding `seo.pro` (app/tenant-admin/seo/page.tsx);
 * a Basic tenant sees the locked card in the Pro tab instead. That is
 * PRESENTATION. The boundary is `requireFeature(FEATURES.SEO_PRO)` on the write
 * routes, which 403 a Basic tenant whatever this component renders.
 *
 * Every rejection the server can return is shown VERBATIM rather than collapsed
 * into a generic failure: the messages in `lib/seo/redirect-write.ts` are
 * written for the owner ("that would create a redirect loop — the destination
 * leads back here"), and swallowing them leaves someone staring at a form that
 * refuses input for no stated reason.
 */

export type { RedirectRow };

interface RedirectsTabProps {
  /** The store's public base, shown so the rules read as real URLs. */
  baseUrl: string;
  initialRedirects: RedirectRow[];
}

const API_PATH = "/api/tenant-admin/seo/redirects";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

const NETWORK_ERROR =
  "Could not reach the server. Check your connection and retry.";

/** Read the server's own message, or fall back when the body is not ours. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: unknown })?.error;
    if (typeof message === "string" && message) return message;
  } catch {
    // Non-JSON body (a proxy error page, an empty 500) — fall through.
  }
  return "Could not save that redirect. Try again.";
}

export function RedirectsTab({ baseUrl, initialRedirects }: RedirectsTabProps) {
  const [redirects, setRedirects] = useState(initialRedirects);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [statusCode, setStatusCode] = useState<SeoRedirectStatusCode>(
    SEO_REDIRECT_DEFAULT_STATUS,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const atLimit = redirects.length >= SEO_REDIRECT_MAX_PER_TENANT;

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPath, toPath, statusCode }),
      });
      if (!response.ok) {
        setError(await errorMessage(response));
        return;
      }

      const body: { redirect: RedirectRow } = await response.json();
      setRedirects((prev) => [body.redirect, ...prev]);
      setFromPath("");
      setToPath("");
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const handleRetarget = async (id: string, nextToPath: string) => {
    setError(null);
    try {
      const response = await fetch(`${API_PATH}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPath: nextToPath }),
      });
      if (!response.ok) {
        setError(await errorMessage(response));
        return false;
      }

      const body: { redirect: RedirectRow } = await response.json();
      setRedirects((prev) =>
        prev.map((row) => (row.id === id ? body.redirect : row)),
      );
      return true;
    } catch {
      setError(NETWORK_ERROR);
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;

    setDeletingId(id);
    setError(null);
    try {
      const response = await fetch(`${API_PATH}/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await errorMessage(response));
        return;
      }
      setRedirects((prev) => prev.filter((row) => row.id !== id));
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="bs-card bs-card-pad space-y-6">
      <div>
        <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
          Redirects
        </h3>
        <p className="text-sm text-bs-fg-muted max-w-[640px]">
          Point an old URL at its replacement. Anyone following the old link —
          a person or a search engine — lands on the new page, and the ranking
          the old page earned moves with it. Paths are relative to{" "}
          <span className="font-mono">{baseUrl}</span>.
        </p>
      </div>

      <form onSubmit={handleAdd} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 sm:items-end">
          <div>
            <label
              htmlFor="redirect-from"
              className="block text-xs font-medium text-bs-fg-muted mb-1"
            >
              Old path
            </label>
            <input
              id="redirect-from"
              className="bs-input font-mono text-sm"
              placeholder="/old-page"
              value={fromPath}
              maxLength={SEO_REDIRECT_MAX_PATH_LENGTH}
              onChange={(e) => setFromPath(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="redirect-to"
              className="block text-xs font-medium text-bs-fg-muted mb-1"
            >
              New path
            </label>
            <input
              id="redirect-to"
              className="bs-input font-mono text-sm"
              placeholder="/new-page"
              value={toPath}
              maxLength={SEO_REDIRECT_MAX_PATH_LENGTH}
              onChange={(e) => setToPath(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="redirect-status"
              className="block text-xs font-medium text-bs-fg-muted mb-1"
            >
              Type
            </label>
            <select
              id="redirect-status"
              className="bs-select"
              value={statusCode}
              onChange={(e) =>
                setStatusCode(Number(e.target.value) as SeoRedirectStatusCode)
              }
            >
              {SEO_REDIRECT_STATUS_CODES.map((code) => (
                <option key={code} value={code}>
                  {code} permanent
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bs-btn bs-btn-green bs-btn-sm"
            disabled={saving || atLimit}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            Add redirect
          </button>
        </div>

        {atLimit && (
          <p className="text-sm text-bs-fg-muted">
            This store is at the {SEO_REDIRECT_MAX_PER_TENANT}-redirect limit.
            Delete one before adding another.
          </p>
        )}

        {error && (
          <p className="text-sm text-bs-danger" role="alert">
            {error}
          </p>
        )}
      </form>

      {redirects.length === 0 ? (
        <p className="text-sm text-bs-fg-muted text-center py-8">
          No redirects yet. Add one when you rename or retire a page.
        </p>
      ) : (
        <div className="divide-y divide-bs-border-100">
          {redirects.map((row) => (
            <RedirectRowItem
              key={row.id}
              row={row}
              busy={deletingId === row.id}
              onRetarget={handleRetarget}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
