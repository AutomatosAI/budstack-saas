import Link from "next/link";
import { Lock } from "lucide-react";
import { UPGRADE_CTA_LABEL, UPGRADE_PATH } from "@/lib/entitlements/upgrade";

/**
 * SEO Supercharge US-013 — the one locked state, built once and reused by every
 * Workstream C story.
 *
 * PRESENTATION ONLY. This component decides what a tenant SEES; it decides
 * nothing about what a tenant may DO. The boundary is `requireFeature(
 * FEATURES.SEO_PRO, …)` on the route (lib/entitlements/require-feature.ts) —
 * a Basic tenant who calls a Pro API by hand gets a 403 whether or not this
 * card ever rendered.
 *
 * Wrapping shape, so a C story adds its section without touching the lock:
 *
 * ```tsx
 * <LockedFeatureCard locked={!seoProUnlocked} title="Redirects" valueProp="…">
 *   <RedirectsManager … />
 * </LockedFeatureCard>
 * ```
 *
 * When unlocked it renders `children` and nothing of its own. When locked it
 * renders the upsell INSTEAD of `children` — the Pro UI must not reach the DOM
 * of a tenant who cannot use it.
 */
interface LockedFeatureCardProps {
  /**
   * Resolved server-side from `tenants.plan` (never from a client-side Clerk
   * read). True for plan 'basic' only: trial, pro and custom all hold
   * `seo.pro`, and trial in particular is the launch window where the tenant is
   * supposed to see Pro working rather than locked.
   */
  locked: boolean;
  title: string;
  /** One line, one concrete benefit — see `lib/seo/pro-features.ts`. */
  valueProp: string;
  children?: React.ReactNode;
}

export function LockedFeatureCard({
  locked,
  title,
  valueProp,
  children,
}: LockedFeatureCardProps) {
  if (!locked) return <>{children}</>;

  return (
    <section className="bs-card bs-card-pad flex flex-col gap-4" data-locked-feature={title}>
      <div className="bs-card-head mb-0">
        <div className="bs-card-icon">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="bs-card-title">{title}</h3>
          <span className="bs-chip bs-chip-gold mt-1.5">Pro</span>
        </div>
      </div>

      <p className="bs-card-desc flex-1">{valueProp}</p>

      <Link href={UPGRADE_PATH} className="bs-btn bs-btn-green bs-btn-sm self-start">
        {UPGRADE_CTA_LABEL}
      </Link>
    </section>
  );
}
