"use client";

/**
 * Cookie consent banner — PECR/GDPR compliant.
 *
 * Behaviour:
 * - Hidden until first decision is made (or after consent expires).
 * - Three categories: Essential (always on), Analytics, Preferences.
 * - Reject-all is visually equal to Accept-all (no nudge).
 * - Re-opens when `window.dispatchEvent(new Event("bs:consent-open"))` fires.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { useConsent } from "@/lib/consent";

export function CookieBanner() {
  const { consent, hasDecided, acceptAll, rejectAll, save } = useConsent();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [preferences, setPreferences] = useState(false);

  // Open by default if no decision exists
  useEffect(() => {
    setMounted(true);
    const reopen = () => {
      setAnalytics(consent?.analytics ?? false);
      setPreferences(consent?.preferences ?? false);
      setShowDetails(true);
      setOpen(true);
    };
    window.addEventListener("bs:consent-open", reopen);
    return () => window.removeEventListener("bs:consent-open", reopen);
  }, [consent]);

  useEffect(() => {
    if (mounted && !hasDecided) {
      setOpen(true);
    }
  }, [mounted, hasDecided]);

  if (!mounted || !open) return null;

  const handleAcceptAll = () => {
    acceptAll();
    setOpen(false);
  };

  const handleRejectAll = () => {
    rejectAll();
    setOpen(false);
  };

  const handleSave = () => {
    save({ analytics, preferences });
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="budstacks-theme fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-[860px] rounded-2xl border border-bs-border bg-bs-bg-1/95 p-5 shadow-2xl backdrop-blur sm:p-6">
        <div className="flex items-start gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-bs-green-400/25 bg-bs-green-400/10 sm:flex">
            <Cookie className="h-5 w-5 text-bs-green-300" />
          </div>

          <div className="flex-1">
            <h2 className="font-bs-serif text-lg font-medium text-bs-fg-0">
              Cookies on BudStacks
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-bs-fg-2">
              We use essential cookies to make this site work. With your consent,
              we'd also like to use analytics cookies to understand how visitors
              use the site, and preference cookies to remember your settings. You
              can change your choice at any time from the footer.{" "}
              <Link
                href="/cookies"
                className="text-bs-green-300 underline-offset-2 hover:underline"
              >
                Read our cookie policy
              </Link>
              .
            </p>

            {showDetails && (
              <div className="mt-4 space-y-3 rounded-xl border border-bs-border bg-bs-bg-2 p-4">
                <ConsentRow
                  title="Essential"
                  description="Required for the site to function — authentication, security, load balancing."
                  checked
                  disabled
                />
                <ConsentRow
                  title="Analytics"
                  description="Help us understand how visitors use the site. Anonymous traffic data only."
                  checked={analytics}
                  onChange={setAnalytics}
                />
                <ConsentRow
                  title="Preferences"
                  description="Remember your settings (language, theme, dashboard layout)."
                  checked={preferences}
                  onChange={setPreferences}
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRejectAll}
                className="rounded-xl border border-bs-border bg-bs-bg-2 px-4 py-2 text-sm font-medium text-bs-fg-1 transition hover:bg-bs-bg-2/70"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="rounded-xl bg-bs-green-500 px-4 py-2 text-sm font-medium text-bs-bg-0 transition hover:bg-bs-green-400 shadow-[0_8px_24px_-8px_rgba(82,217,122,0.5)]"
              >
                Accept all
              </button>
              {showDetails ? (
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-xl border border-bs-green-400/30 bg-bs-green-400/10 px-4 py-2 text-sm font-medium text-bs-green-300 transition hover:bg-bs-green-400/20"
                >
                  Save preferences
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAnalytics(consent?.analytics ?? false);
                    setPreferences(consent?.preferences ?? false);
                    setShowDetails(true);
                  }}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-bs-fg-2 transition hover:text-bs-fg-0"
                >
                  Manage preferences
                </button>
              )}
              <span className="ml-auto inline-flex items-center gap-1.5 font-bs-mono text-[10.5px] uppercase tracking-[0.14em] text-bs-fg-3">
                <ShieldCheck className="h-3.5 w-3.5" />
                GDPR / PECR
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRejectAll}
            aria-label="Close — reject non-essential cookies"
            className="-mr-1 -mt-1 rounded-full p-1.5 text-bs-fg-3 transition hover:bg-bs-bg-2 hover:text-bs-fg-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConsentRowProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}

function ConsentRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: ConsentRowProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 ${
        disabled ? "cursor-not-allowed opacity-80" : ""
      }`}
    >
      <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`block h-5 w-9 rounded-full border transition ${
            checked
              ? "border-bs-green-400 bg-bs-green-400/30"
              : "border-bs-border bg-bs-bg-1"
          }`}
        />
        <span
          aria-hidden
          className={`absolute left-0.5 h-4 w-4 rounded-full transition-transform ${
            checked
              ? "translate-x-4 bg-bs-green-400"
              : "translate-x-0 bg-bs-fg-3"
          }`}
        />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-bs-fg-0">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-bs-fg-2">
          {description}
        </span>
      </span>
    </label>
  );
}

/**
 * Helper for footer "Cookie preferences" link — opens the banner.
 * Use in any footer/page link as: onClick={openCookiePreferences}
 */
export function openCookiePreferences() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("bs:consent-open"));
  }
}
