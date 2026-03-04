'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { SectionProps } from '@/lib/types/section-props';

export function HeroSplit({
  tenant,
  heroImageUrl,
  logoUrl,
  pageContent,
  sectionConfig,
  consultationUrl,
}: SectionProps) {
  const businessName = tenant.businessName;
  const title = sectionConfig?.title || pageContent?.home?.heroTitle || pageContent?.homeHeroTitle || `Welcome to ${businessName}`;
  const subtitle = sectionConfig?.subtitle || pageContent?.home?.heroSubtitle || pageContent?.homeHeroSubtitle || 'Premium Cannabis, Delivered';
  const description = sectionConfig?.description || pageContent?.home?.heroDescription || pageContent?.homeHeroDescription;
  const ctaText = sectionConfig?.ctaText || 'Book Consultation';
  const secondaryCtaText = sectionConfig?.secondaryCtaText || 'Learn More';
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '#about';

  // Logo placement
  const logoPlacement = pageContent?.logoPlacement;
  const showHeroLogo = logoPlacement?.heroShowLogo ?? true;
  const heroLogoSize = logoPlacement?.heroSize || 'medium';
  const heroLogoStyle = logoPlacement?.heroStyle || 'plain';
  const heroSizeMap: Record<string, string> = { small: '48px', medium: '64px', large: '96px', watermark: '200px' };
  const heroLogoSizePx = heroSizeMap[heroLogoSize] || '64px';

  return (
    <section
      className="min-h-[calc(100dvh-4rem)] flex items-center"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
    >
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            {showHeroLogo && logoUrl && (
              <div
                className={`relative mb-6 ${heroLogoStyle === 'circular' ? 'rounded-full overflow-hidden border-4 border-white/30 shadow-xl' : ''} ${heroLogoStyle === 'badge' ? 'rounded-xl bg-white/90 shadow-lg p-2' : ''} ${heroLogoSize === 'watermark' ? 'opacity-[0.12]' : ''}`}
                style={{ width: heroLogoSizePx, height: heroLogoSizePx }}
              >
                <Image src={logoUrl} alt={`${businessName} Logo`} fill className={heroLogoStyle === 'circular' ? 'object-cover' : 'object-contain'} />
              </div>
            )}

            <h1
              className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6"
              style={{
                fontFamily: 'var(--tenant-font-heading, sans-serif)',
                color: 'hsl(var(--tenant-color-heading))',
              }}
            >
              {title}
            </h1>

            <p
              className="text-base sm:text-xl mb-4"
              style={{ color: 'hsl(var(--tenant-color-primary))' }}
            >
              {subtitle}
            </p>

            {description && (
              <p
                className="text-base sm:text-lg mb-6 sm:mb-8 max-w-lg"
                style={{ color: 'hsl(var(--tenant-color-text))' }}
              >
                {description}
              </p>
            )}

            <div className="flex flex-wrap gap-4">
              <a
                href={consultationUrl}
                className="px-8 py-3 text-base font-semibold text-white rounded-lg transition-all hover:opacity-90"
                style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
              >
                {ctaText}
              </a>
              <a
                href={secondaryCtaHref}
                className="px-8 py-3 text-base font-semibold rounded-lg border-2 transition-all hover:opacity-80"
                style={{
                  borderColor: 'hsl(var(--tenant-color-primary))',
                  color: 'hsl(var(--tenant-color-primary))',
                }}
              >
                {secondaryCtaText}
              </a>
            </div>
          </motion.div>

          {/* Image Side */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl"
          >
            {heroImageUrl ? (
              <Image
                src={heroImageUrl}
                alt={`${businessName} Hero`}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg,
                    hsl(var(--tenant-color-primary) / 0.3) 0%,
                    hsl(var(--tenant-color-secondary) / 0.3) 100%)`,
                }}
              />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
