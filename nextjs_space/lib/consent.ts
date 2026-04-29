/**
 * Cookie consent state management.
 *
 * Stored in localStorage as `bs_consent_v1`. Decision is essential-only by
 * default; user must opt in to analytics or preferences cookies (PECR/GDPR
 * compliant — no pre-ticked boxes, no implicit consent).
 *
 * Bump CONSENT_VERSION when categories change to re-prompt all users.
 */

"use client";

import { useEffect, useState, useCallback } from "react";

export const CONSENT_VERSION = 1;
const CONSENT_KEY = "bs_consent_v1";
const CONSENT_TTL_DAYS = 365;

export type ConsentCategory = "essential" | "analytics" | "preferences";

export interface ConsentState {
  version: number;
  decidedAt: string; // ISO date
  essential: true; // always true — required for site to function
  analytics: boolean;
  preferences: boolean;
}

const DEFAULT_CONSENT: ConsentState = {
  version: CONSENT_VERSION,
  decidedAt: "",
  essential: true,
  analytics: false,
  preferences: false,
};

function isExpired(decidedAt: string): boolean {
  if (!decidedAt) return true;
  const decided = new Date(decidedAt).getTime();
  if (Number.isNaN(decided)) return true;
  const ageMs = Date.now() - decided;
  return ageMs > CONSENT_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (isExpired(parsed.decidedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setConsent(
  partial: Partial<Pick<ConsentState, "analytics" | "preferences">>,
): ConsentState {
  const next: ConsentState = {
    ...DEFAULT_CONSENT,
    ...partial,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    essential: true,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
    // Notify listeners on the same tab (storage event only fires cross-tab)
    window.dispatchEvent(new CustomEvent("bs:consent-changed", { detail: next }));
  }
  return next;
}

export function clearConsent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONSENT_KEY);
  window.dispatchEvent(new CustomEvent("bs:consent-changed", { detail: null }));
}

/**
 * React hook — returns current consent state, refreshes on changes.
 * Returns null until a decision has been made (or it's expired).
 */
export function useConsent(): {
  consent: ConsentState | null;
  hasDecided: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  save: (partial: Partial<Pick<ConsentState, "analytics" | "preferences">>) => void;
  reset: () => void;
} {
  const [consent, setConsentState] = useState<ConsentState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsentState(getConsent());
    setHydrated(true);

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState | null>).detail;
      setConsentState(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) setConsentState(getConsent());
    };
    window.addEventListener("bs:consent-changed", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("bs:consent-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const acceptAll = useCallback(() => {
    setConsentState(setConsent({ analytics: true, preferences: true }));
  }, []);

  const rejectAll = useCallback(() => {
    setConsentState(setConsent({ analytics: false, preferences: false }));
  }, []);

  const save = useCallback(
    (partial: Partial<Pick<ConsentState, "analytics" | "preferences">>) => {
      setConsentState(setConsent(partial));
    },
    [],
  );

  const reset = useCallback(() => {
    clearConsent();
    setConsentState(null);
  }, []);

  return {
    consent,
    hasDecided: hydrated && consent !== null,
    acceptAll,
    rejectAll,
    save,
    reset,
  };
}
