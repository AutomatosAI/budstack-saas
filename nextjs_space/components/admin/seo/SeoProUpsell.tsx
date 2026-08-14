import { SEO_PRO_FEATURES } from "@/lib/seo/pro-features";
import { LockedFeatureCard } from "./LockedFeatureCard";

/**
 * SEO Supercharge US-013 — the Pro tab of the SEO Manager, as a Basic tenant
 * sees it: a locked card per Workstream C capability instead of a blank space.
 *
 * Rendered ONLY when `seo.pro` is absent (see app/tenant-admin/seo/page.tsx),
 * so trial, pro and custom tenants never meet it. As C stories land they add
 * their real sections to this surface wrapped in `LockedFeatureCard`, and this
 * whole-tab fallback shrinks to whatever is still unbuilt.
 */
export function SeoProUpsell() {
  return (
    <div className="space-y-6">
      <div>
        <h3
          className="text-[22px] leading-tight"
          style={{
            fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
          }}
        >
          SEO Pro
        </h3>
        <p className="text-sm text-bs-fg-muted max-w-[640px]">
          Your plan covers the metadata, sitemaps and canonicals behind every
          page you have edited here. Pro adds the parts search engines read
          beyond the title tag.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SEO_PRO_FEATURES.map((feature) => (
          <LockedFeatureCard
            key={feature.id}
            locked
            title={feature.title}
            valueProp={feature.valueProp}
          />
        ))}
      </div>
    </div>
  );
}
