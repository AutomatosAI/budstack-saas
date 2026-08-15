import type { ReactNode } from "react";
import { Navbar, Footer } from "@/components/landing";

/**
 * The bs-* design system is dark-first: bs-fg is light text for the dark
 * bs-canvas ground. The platform site's body is light, so every /documents
 * page paints the canvas itself — same ground the admin renders on, which
 * also makes the embedded admin screenshots sit naturally.
 *
 * .budstacks-theme sits on the OUTER element purely to hand the shared dark
 * Navbar/Footer their shadcn tokens. It carries its own `background`, so the
 * bs-canvas ground goes on a nested element rather than competing with it at
 * equal specificity — the clash that #247/#248 already had to fix once.
 */
export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="budstacks-theme">
      <div className="flex min-h-screen flex-col bg-bs-canvas text-bs-fg">
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </div>
  );
}
