'use client';

import './styles.css';

import React from 'react';
import { Tenant } from '@/types/client';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import ValueProps from './components/ValueProps';
import About from './components/About';
import Features from './components/Features';
import Stats from './components/Stats';
import FAQ from './components/FAQ';
import ConsultationCTA from './components/ConsultationCTA';
import Footer from './components/Footer';

interface TemplateProps {
  tenant: Tenant;
  consultationUrl?: string;
  productsUrl?: string;
  contactUrl?: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  posts?: any[];
}

export default function CannabizzTemplate({
  tenant,
  consultationUrl = '/consultation',
  productsUrl = '/products',
  contactUrl = '/contact',
  heroImageUrl,
  logoUrl,
  posts,
}: TemplateProps) {
  const settings = (tenant.settings as any) || {};
  const pageContent = settings.pageContent || {};

  return (
    <div
      className="template-cannabizz overflow-x-hidden"
      style={{
        fontFamily: 'var(--tenant-font-base, sans-serif)',
        backgroundColor: 'hsl(var(--tenant-color-background))',
        color: 'hsl(var(--tenant-color-text))',
      }}
    >
      <Navigation
        businessName={tenant.businessName}
        logoUrl={logoUrl || settings.logoPath}
      />
      <main>
        <Hero
          businessName={tenant.businessName}
          title={pageContent.homeHeroTitle || pageContent.home?.heroTitle}
          subtitle={pageContent.homeHeroSubtitle || pageContent.home?.heroSubtitle}
          description={pageContent.homeHeroDescription || pageContent.home?.heroDescription}
          heroImageUrl={heroImageUrl || settings.heroImagePath}
          logoUrl={logoUrl || settings.logoPath}
          consultationUrl={consultationUrl}
        />
        <ValueProps businessName={tenant.businessName} />
        <About
          businessName={tenant.businessName}
          heading={pageContent.aboutHeading}
          content={pageContent.aboutMission}
        />
        <Features />
        <Stats />
        <FAQ />
        <ConsultationCTA
          businessName={tenant.businessName}
          consultationUrl={consultationUrl}
        />
      </main>
      <Footer
        businessName={tenant.businessName}
        logoUrl={logoUrl || settings.logoPath}
      />
    </div>
  );
}
