"use client";

import { openCookiePreferences } from "./CookieBanner";

interface Props {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Client-side button that re-opens the cookie consent banner.
 * Use anywhere a footer/legal link should let the user revisit their choice.
 */
export function CookiePreferencesLink({
  className = "text-[13.5px] text-bs-fg-1 transition hover:text-bs-fg-0",
  children = "Cookie preferences",
}: Props) {
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className={className}
    >
      {children}
    </button>
  );
}
