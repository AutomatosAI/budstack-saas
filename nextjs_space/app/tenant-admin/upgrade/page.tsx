import Link from "next/link";
import { ArrowLeft, Check, MessageSquare } from "lucide-react";
import {
  BASIC_PLAN_PRICE_LABEL,
  PRO_PLAN_PRICE_LABEL,
  UPGRADE_CONTACT_PATH,
} from "@/lib/entitlements/upgrade";
import { SEO_PRO_FEATURES } from "@/lib/seo/pro-features";

/**
 * SEO Supercharge US-013 — where every locked card's CTA lands.
 *
 * Deliberately STATIC: no plan lookup, no checkout, no payment code. It
 * explains what Pro contains and hands the tenant to the existing public
 * contact form; an operator then sets the plan from the super-admin console
 * (US-012). Billing is PRD-303 and replaces the contact CTA without touching
 * anything else here.
 *
 * No page-level permission gate: it holds no tenant data. Access is the
 * tenant-admin layout's — Clerk session plus the TENANT_ADMIN/SUPER_ADMIN role
 * check in app/tenant-admin/layout.tsx.
 */
export const metadata = {
  title: "Upgrade to Pro",
};

const BASIC_INCLUDED = [
  "Editable titles and descriptions for products, posts, conditions and static pages",
  "Metadata rendered on every storefront page, not just the homepage",
  "Sitemap and robots.txt kept in step with what you publish",
  "A canonical URL on every public page",
];

export default function UpgradePage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/tenant-admin/seo"
          className="bs-btn bs-btn-text bs-btn-sm -ml-2 mb-3"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to SEO Manager
        </Link>
        <div className="bs-page-header-centered">
          <h1 className="bs-page-title">Upgrade to Pro</h1>
          <p className="bs-page-subtitle">
            Pro is {PRO_PLAN_PRICE_LABEL}, up from {BASIC_PLAN_PRICE_LABEL} on
            Basic. It adds the structured data, social previews and URL controls
            that search engines read beyond your page titles.
          </p>
        </div>
      </div>

      <section className="bs-card bs-card-pad space-y-4">
        <div>
          <h2 className="bs-card-title">What Pro adds</h2>
          <p className="bs-card-desc">
            Everything on Basic stays; these are the additions.
          </p>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {SEO_PRO_FEATURES.map((feature) => (
            <li key={feature.id} className="flex gap-3">
              <Check
                className="h-4 w-4 mt-1 flex-shrink-0 text-bs-green-soft"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-medium text-bs-fg">{feature.title}</p>
                <p className="text-sm text-bs-fg-muted">{feature.valueProp}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bs-card bs-card-pad space-y-4">
        <div>
          <h2 className="bs-card-title">
            Already on Basic ({BASIC_PLAN_PRICE_LABEL})
          </h2>
          <p className="bs-card-desc">
            None of this changes when you upgrade.
          </p>
        </div>
        <ul className="space-y-2">
          {BASIC_INCLUDED.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-bs-fg-muted">
              <Check
                className="h-4 w-4 mt-0.5 flex-shrink-0 text-bs-fg-muted"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="bs-card bs-card-pad space-y-4">
        <div>
          <h2 className="bs-card-title">Switching plans</h2>
          <p className="bs-card-desc">
            There is no self-serve checkout yet. Send us a message and we will
            move your account to Pro and confirm by email — Pro features appear
            in your SEO Manager as soon as the change is applied.
          </p>
        </div>
        <Link
          href={UPGRADE_CONTACT_PATH}
          className="bs-btn bs-btn-green self-start"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          Talk to us about Pro
        </Link>
      </section>
    </div>
  );
}
