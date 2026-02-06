'use client';

import './styles.css';

import React from 'react';
import { Tenant } from '@/types/client';
import Hero from './components/Hero';
import ProductShowcase from './components/ProductShowcase';
import LifestyleSection from './components/LifestyleSection';
import ConsultationCTA from './components/ConsultationCTA';

interface TemplateProps {
  tenant: Tenant;
  consultationUrl: string;
  productsUrl: string;
  contactUrl: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
}

export default function GTACannabisTemplate({
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
    <div className="gta-template overflow-x-hidden">
      <Hero
        businessName={tenant.businessName}
        title={pageContent.home?.heroTitle}
        subtitle={pageContent.home?.heroSubtitle}
        heroImagePath={heroImageUrl || settings.heroImagePath}
        logoPath={logoUrl || settings.logoPath}
        consultationUrl={consultationUrl}
        ctaText={pageContent.home?.heroCtaText}
      />

      <ProductShowcase
        businessName={tenant.businessName}
        productsUrl={productsUrl}
      />

      <LifestyleSection
        businessName={tenant.businessName}
        title={pageContent.about?.title}
        content={pageContent.about?.content}
      />

      <ConsultationCTA
        businessName={tenant.businessName}
        consultationUrl={consultationUrl}
        title={pageContent.contact?.title}
        description={pageContent.contact?.description}
      />
    </div>
  );
}
