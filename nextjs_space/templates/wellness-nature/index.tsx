'use client';

import './styles.css';

import React from 'react';
import { Tenant } from '@/types/client';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import Benefits from './components/Benefits';
import ProductCategories from './components/ProductCategories';
import Testimonials from './components/Testimonials';
import ConsultationCTA from './components/ConsultationCTA';

interface TemplateProps {
  tenant: Tenant;
  consultationUrl: string;
  productsUrl: string;
  contactUrl: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
}

export default function WellnessNatureTemplate({
  tenant,
  consultationUrl,
  productsUrl,
  contactUrl,
  heroImageUrl,
  logoUrl
}: TemplateProps) {
  const settings = (tenant.settings as any) || {};
  const pageContent = settings.pageContent || {};

  return (
    <div className="wellness-template overflow-x-hidden" style={{ fontFamily: 'var(--tenant-font-base, "Lora", serif)' }}>
      {/* Custom Wellness Navigation */}
      <Navigation
        businessName={tenant.businessName}
        logoUrl={logoUrl}
        tenant={tenant}
      />

      <Hero
        businessName={tenant.businessName}
        title={pageContent.homeHeroTitle}
        subtitle={pageContent.homeHeroSubtitle}
        heroImagePath={heroImageUrl}
        logoPath={logoUrl}
        consultationUrl={consultationUrl}
      />

      {/* Extra spacing after hero */}
      <div className="h-16"></div>

      <Benefits
        businessName={tenant.businessName}
      />

      {/* Extra spacing between sections */}
      <div className="h-20"></div>

      <ProductCategories
        productsUrl={productsUrl}
      />

      {/* Extra spacing between sections */}
      <div className="h-20"></div>

      <Testimonials />

      {/* Extra spacing before CTA */}
      <div className="h-16"></div>

      <ConsultationCTA
        businessName={tenant.businessName}
        consultationUrl={consultationUrl}
      />
    </div>
  );
}
