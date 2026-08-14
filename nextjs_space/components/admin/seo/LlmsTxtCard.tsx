import { LLMS_TXT_HONESTY_COPY } from "@/lib/seo/llms-txt-copy";

/**
 * LLM Visibility US-003 — what the store publishes at /llms.txt, and what that
 * is actually worth.
 *
 * THE HONEST FRAMING IS THE ACCEPTANCE CRITERION. Every other card in the SEO
 * Manager describes a lever with evidence behind it; this one describes a bet
 * that has not paid off yet, and says so in the same breath as the feature. The
 * copy lives in `lib/seo/llms-txt-copy.ts` as constants so a test can assert
 * that the four claims — proposed standard, ~10% adoption, no measured citation
 * lift, no cost — are still on the screen.
 *
 * No state and no handlers: the file is generated on request from the catalogue,
 * so there is nothing here to configure. It is still part of the CLIENT bundle
 * (the SEO Manager that renders it is a client component), which is exactly why
 * its copy comes from that dependency-free module and not from the builder.
 *
 * Rendered only for a tenant holding `seo.pro` (app/tenant-admin/seo/
 * seo-page-client.tsx). That is PRESENTATION — the boundary is the route, which
 * 404s the file itself for a Basic tenant.
 */

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface LlmsTxtCardProps {
  /** The published file, on the store's primary host. */
  llmsUrl: string;
}

export function LlmsTxtCard({ llmsUrl }: LlmsTxtCardProps) {
  return (
    <section className="bs-card bs-card-pad space-y-4">
      <div>
        <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
          llms.txt
        </h3>
        <p className="text-sm text-bs-fg-muted max-w-[720px]">
          {LLMS_TXT_HONESTY_COPY.whatItIs}
        </p>
      </div>

      <div className="rounded-bs-md border border-bs-border-100 p-4 space-y-2">
        <h4 className="text-sm font-medium text-bs-fg">
          What it is worth, plainly
        </h4>
        <p className="text-xs text-bs-fg-muted">
          {LLMS_TXT_HONESTY_COPY.evidence}
        </p>
        <p className="text-xs text-bs-fg-muted">
          {LLMS_TXT_HONESTY_COPY.whyItShips}
        </p>
      </div>

      <p className="text-xs text-bs-fg-muted">
        Your store publishes it at{" "}
        <a
          href={llmsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-bs-fg break-all"
        >
          {llmsUrl}
        </a>
        . {LLMS_TXT_HONESTY_COPY.upkeep}
      </p>
    </section>
  );
}
