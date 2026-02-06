'use client';

import { Tenant } from "@/types/client";
import Hero from "./components/Hero";
import AboutHero from "./components/AboutHero";
import ValueProps from "./components/ValueProps";
import Cultivation from "./components/Cultivation";
import News from "./components/News";
import BackToTop from "./components/BackToTop";
import PageTransition from "./components/PageTransition";

interface TemplateProps {
  tenant: Tenant;
  consultationUrl?: string;
  productsUrl?: string;
  contactUrl?: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  posts?: any[];
}

export default function LovableTemplate({
  tenant,
  consultationUrl,
  productsUrl,
  contactUrl,
  heroImageUrl,
  logoUrl,
  posts
}: TemplateProps) {
  return (
    <PageTransition variant="elegant">
      <div
        className="min-h-screen template-healingbuds"
        style={{
          fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)',
          backgroundColor: 'var(--tenant-color-background, hsl(var(--background)))',
          color: 'var(--tenant-color-text, hsl(var(--foreground)))'
        }}
      >
        <main>
          <Hero
            businessName={tenant.businessName}
            heroImageUrl={heroImageUrl}
            tenant={tenant}
          />
          <AboutHero />
          <ValueProps />
          <Cultivation />
          <News posts={posts} tenantSlug={tenant.subdomain || 'demo'} />
        </main>

        <BackToTop />
      </div>
    </PageTransition>
  );
}
