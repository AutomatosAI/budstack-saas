'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { InteractiveImage } from '@/components/ui/interactive-image';

export function HeroFullScreen({
  tenant,
  heroImageUrl,
  logoUrl,
  pageContent,
  sectionConfig,
  sectionId,
  consultationUrl,
}: SectionProps) {
  const businessName = tenant.businessName;
  const title = sectionConfig?.title || pageContent?.home?.heroTitle || pageContent?.homeHeroTitle || `Welcome to ${businessName}`;
  const subtitle = sectionConfig?.subtitle || pageContent?.home?.heroSubtitle || pageContent?.homeHeroSubtitle || 'Premium Cannabis, Elevated Experience';
  const description = sectionConfig?.description || pageContent?.home?.heroDescription || pageContent?.homeHeroDescription;
  const ctaText = sectionConfig?.ctaText || 'Book Consultation';
  const secondaryCtaText = sectionConfig?.secondaryCtaText || '';
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '#about';

  // Text alignment — sectionConfig (editor) wins over legacy pageContent
  const heroAlignment = sectionConfig?.textAlign || pageContent?.home?.heroAlignment || 'left';
  const isLeft = heroAlignment === 'left';
  const isRight = heroAlignment === 'right';
  const isCenter = heroAlignment === 'center' || (!isLeft && !isRight);

  // Advanced configurations from tenant settings
  const heroOverlayStyle = pageContent?.home?.heroOverlayStyle || 'gradient-dark';
  const heroOverlayOpacity = pageContent?.home?.heroOverlayOpacity ?? 70;
  const heroHeight = sectionConfig?.heroHeight || pageContent?.home?.heroHeight || 'large';

  // Map height enum to classes — 'full' accounts for nav bar height
  const heightClass: Record<string, string> = {
    medium: 'min-h-[60vh] py-20',
    large: 'min-h-[80vh] py-32',
    full: 'min-h-[calc(100dvh-4rem)]',
  };

  const selectedHeightClass = heightClass[heroHeight as string] || heightClass['large'];

  // Hero display mode — from tenant settings or sectionConfig, defaults to gradient-image for backward compat
  const heroType = sectionConfig?.heroType || (tenant as any).settings?.heroType || 'gradient-image';
  const showImage = heroImageUrl && (heroType === 'image' || heroType === 'gradient-image');

  // DEBUG: trace image rendering (remove after fix confirmed)
  console.log('[HeroFullScreen DEBUG]', {
    heroImageUrl: heroImageUrl?.substring(0, 80) || '(none)',
    heroType,
    showImage,
    'sectionConfig.imageUrl': sectionConfig?.imageUrl?.substring(0, 80) || '(none)',
    'sectionConfig.heroType': sectionConfig?.heroType || '(none)',
  });
  const showGradientOverlay = heroType === 'gradient' || heroType === 'gradient-image';

  // Extract interactive hotspots if configured and filter by target section
  const allHotspots = pageContent?.educationHotspots || [];
  const hotspots = allHotspots.filter((h: any) =>
    !h.targetSectionId || h.targetSectionId === 'all' || h.targetSectionId === sectionId
  );

  const hasHotspots = hotspots.length > 0;
  const glassEffect = tenant?.settings?.glassEffect || "none";

  // Logo placement from branding editor
  const logoPlacement = pageContent?.logoPlacement;
  const showHeroLogo = logoPlacement?.heroShowLogo ?? true;
  const heroLogoX = logoPlacement?.heroX ?? 50;
  const heroLogoY = logoPlacement?.heroY ?? 20;
  const heroLogoSize = logoPlacement?.heroSize || 'medium';
  const heroLogoStyle = logoPlacement?.heroStyle || 'circular';
  const heroSizeLegacy: Record<string, number> = { small: 48, medium: 80, large: 120, watermark: 300 };
  const resolvedHeroSize = typeof heroLogoSize === 'number' ? heroLogoSize : (heroSizeLegacy[heroLogoSize] || 80);
  const heroLogoSizePx = `${resolvedHeroSize}px`;
  const heroLogoMaxPx = `${resolvedHeroSize}px`;

  return (
    <section className={`relative ${selectedHeightClass} flex items-center justify-center overflow-hidden`}>
      {/* Background: Image if available and heroType allows, otherwise rich gradient */}
      {showImage ? (
        <div className="absolute inset-0 z-0">
          {hasHotspots ? (
            <InteractiveImage
              src={heroImageUrl!}
              alt="Hero Background"
              hotspots={hotspots}
              glassEffect={glassEffect as any}
              className="w-full h-full object-cover min-h-[500px]"
            />
          ) : heroImageUrl!.includes('X-Amz-') ? (
            /* Signed S3 URLs bypass next/image to avoid optimization proxy issues in the editor */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={heroImageUrl!} alt="Hero Background" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Image
              src={heroImageUrl!}
              alt="Hero Background"
              fill
              className="object-cover"
              priority
            />
          )}
        </div>
      ) : (
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `linear-gradient(135deg,
              hsl(var(--tenant-color-background)) 0%,
              hsl(var(--tenant-color-primary) / 0.3) 50%,
              hsl(var(--tenant-color-background)) 100%)`,
          }}
        />
      )}

      {/* Dynamic Overlay based on Advanced Configuration */}
      {heroOverlayStyle !== 'none' && (
        <div
          className="absolute inset-0 z-[1]"
          style={{
            opacity: heroOverlayOpacity / 100,
            background:
              heroOverlayStyle === 'dark'
                ? 'black'
                : heroOverlayStyle === 'gradient-primary'
                  ? `linear-gradient(135deg, hsl(var(--tenant-color-primary)) 0%, transparent 100%)`
                  : /* gradient-dark default */ `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)`,
          }}
        />
      )}

      {/* Ambient glow effects — adds depth without needing images */}
      <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden">
        <div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-[120px] opacity-20"
          style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-[120px] opacity-15"
          style={{ backgroundColor: 'hsl(var(--tenant-color-secondary))' }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-1/3 h-1/3 rounded-full blur-[100px] opacity-10"
          style={{ backgroundColor: 'hsl(var(--tenant-color-accent))' }}
        />
      </div>

      {/* Positioned Hero Logo */}
      {showHeroLogo && logoUrl && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: `${heroLogoX}%`,
            top: `${heroLogoY}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className={`relative ${heroLogoStyle === 'circular' ? 'rounded-full overflow-hidden border-4 border-white/30 shadow-2xl' : ''} ${heroLogoStyle === 'badge' ? 'rounded-xl bg-white/90 shadow-lg p-2' : ''} ${heroLogoSize === 'watermark' ? 'opacity-[0.12]' : ''}`}
            style={{
              width: heroLogoSizePx,
              height: heroLogoSizePx,
              maxWidth: heroLogoMaxPx,
              maxHeight: heroLogoMaxPx,
            }}
          >
            <Image
              src={logoUrl}
              alt={`${businessName} Logo`}
              fill
              className={heroLogoStyle === 'circular' ? 'object-cover' : 'object-contain'}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`relative z-10 container mx-auto px-6 ${isLeft ? 'text-left' : isRight ? 'text-right' : 'text-center'}`}>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={`text-3xl sm:text-5xl md:text-7xl font-bold text-white mb-4 sm:mb-6 ${isLeft ? 'max-w-3xl' : isRight ? 'max-w-3xl ml-auto' : ''}`}
          style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className={`text-base sm:text-xl md:text-2xl text-white/90 mb-4 max-w-2xl ${isRight ? 'ml-auto' : isLeft ? '' : 'mx-auto'}`}
        >
          {subtitle}
        </motion.p>

        {description && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className={`text-sm sm:text-lg text-white/75 mb-6 sm:mb-10 max-w-xl ${isRight ? 'ml-auto' : isLeft ? '' : 'mx-auto'}`}
          >
            {description}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className={`flex flex-col sm:flex-row gap-4 ${isLeft ? 'justify-start items-start' :
            isRight ? 'justify-end items-end w-full' :
              'justify-center items-center'
            } mt-8`}
        >
          <a
            href={consultationUrl}
            className="px-8 py-3 text-base font-semibold text-white rounded-full transition-all hover:scale-105"
            style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
          >
            {ctaText}
          </a>
          {secondaryCtaText && (
            <a
              href={secondaryCtaHref}
              className="px-8 py-3 text-base font-semibold border-2 border-white text-white rounded-full hover:bg-white/10 transition-all"
            >
              {secondaryCtaText}
            </a>
          )}
        </motion.div>
      </div>

      {/* Scroll Indicator (Only show if Height is Full Screen) */}
      {heroHeight === 'full' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white cursor-pointer"
          onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronDown size={36} />
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
