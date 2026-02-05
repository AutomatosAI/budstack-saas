'use client';

import './styles.css';
import { Tenant } from '@/types/client';
import Hero from './components/Hero';
import ConsultationCTA from './components/ConsultationCTA';

interface TemplateProps {
  tenant: Tenant;
  consultationUrl?: string;
  productsUrl?: string;
  contactUrl?: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  posts?: any[];
}

export default function YellowHazeTemplate({
  tenant,
  consultationUrl,
  productsUrl,
  contactUrl,
  heroImageUrl,
  logoUrl,
  posts
}: TemplateProps) {
  return (
    <div
      className="template-yellow-haze"
      style={{
        fontFamily: 'var(--tenant-font-base, sans-serif)',
        backgroundColor: 'var(--tenant-color-background)',
        color: 'var(--tenant-color-text)'
      }}
    >
      <main>
        <Hero
          businessName={tenant.businessName}
          heroImageUrl={heroImageUrl}
          consultationUrl={consultationUrl}
        />

        {/* Add more sections here as needed */}

        <ConsultationCTA
          businessName={tenant.businessName}
          consultationUrl={consultationUrl}
        />
      </main>
    </div>
  );
}
