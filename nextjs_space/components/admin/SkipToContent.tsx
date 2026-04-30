"use client";

import { cn } from "@/lib/utils";

/**
 * Keyboard skip-link to main content. Visually hidden until focused.
 */

export interface SkipToContentProps {
  theme?: "super-admin" | "tenant-admin";
  targetId?: string;
}

export function SkipToContent({
  theme = "tenant-admin",
  targetId = "main-content",
}: SkipToContentProps) {
  const styles = {
    bg: "bg-bs-card border border-bs-border",
    text: "text-bs-fg",
    ring: "focus:ring-bs-green/40",
    shadow: "shadow-bs-card-hover",
  };

  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleSkip}
      className={cn(
        // Positioning - fixed at top, initially off-screen
        "fixed top-4 left-4 z-[100]",
        // Transform off-screen by default (account for top-4 offset + extra margin)
        "-translate-y-[calc(100%+2rem)]",
        // Slide down with dramatic animation on focus
        "focus:translate-y-0 focus:animate-skip-link-slide",
        // Styling
        styles.bg,
        styles.text,
        "px-6 py-3 rounded-lg font-semibold text-sm",
        // Focus ring with offset
        "focus:outline-none focus:ring-2",
        styles.ring,
        "focus:ring-offset-2 focus:ring-offset-bs-bg",
        // Shadow and depth
        "shadow-lg",
        styles.shadow,
        // Smooth transitions
        "transition-all duration-200 ease-out",
        // Prevent text selection
        "select-none",
        // Cursor
        "cursor-pointer",
      )}
      aria-label={`Skip to ${targetId.replace("-", " ")}`}
    >
      <span className="flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
        Skip to main content
      </span>
    </a>
  );
}
