import type { ReactNode } from "react";

/**
 * The bs-* design system is dark-first: bs-fg is light text for the dark
 * bs-canvas ground. The platform site's body is light, so every /documents
 * page paints the canvas itself — same ground the admin renders on, which
 * also makes the embedded admin screenshots sit naturally.
 */
export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-bs-canvas text-bs-fg">{children}</div>;
}
