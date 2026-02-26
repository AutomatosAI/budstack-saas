'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

export function HeroVideo({
  tenant,
  heroImageUrl,
  logoUrl,
  pageContent,
  sectionConfig,
  consultationUrl,
}: SectionProps) {
  const businessName = tenant.businessName;
  const title = sectionConfig?.title || pageContent?.home?.heroTitle || pageContent?.homeHeroTitle || `Welcome to ${businessName}`;
  const subtitle = sectionConfig?.subtitle || pageContent?.home?.heroSubtitle || pageContent?.homeHeroSubtitle || 'Premium Cannabis, Elevated Experience';
  const ctaText = sectionConfig?.ctaText || 'Book Consultation';
  const videoUrl = sectionConfig?.videoUrl;
  const textAlign = sectionConfig?.textAlign || 'center';
  const watermarkUrl = sectionConfig?.watermarkUrl;

  // Resolve hero type and overlay settings
  // Priority: sectionConfig (template-level) > auto-detect (videoUrl) > tenant settings > fallback
  // This ensures templates with a videoUrl actually play video, even if the tenant's
  // branding settings have heroType defaulted to "gradient-image".
  const settings = (tenant.settings as any) || {};
  const heroType = sectionConfig?.heroType || (videoUrl ? 'video' : null) || settings.heroType || 'gradient-image';
  const overlayOpacity = settings.heroOverlayOpacity || sectionConfig?.overlayOpacity || 0.55;

  // Text alignment — from tenant settings or layout.json sectionConfig
  const heroAlignment = pageContent?.home?.heroAlignment || sectionConfig?.textAlign || 'left';
  const isLeft = heroAlignment === 'left';
  const isRight = heroAlignment === 'right';
  const isCenter = heroAlignment === 'center' || (!isLeft && !isRight);

  // Advanced configurations from tenant settings
  const heroOverlayStyle = pageContent?.home?.heroOverlayStyle || 'gradient-dark';
  const heroOverlayOpacity = pageContent?.home?.heroOverlayOpacity ?? 55;
  const heroHeight = pageContent?.home?.heroHeight || 'large';

  // Map height enum to classes
  const heightClass: Record<string, string> = {
    medium: 'min-h-[500px] py-20',
    large: 'min-h-[700px] py-32',
    full: 'min-h-screen',
  };

  const selectedHeightClass = heightClass[heroHeight as string] || heightClass['large'];

  const alignClasses = isLeft
    ? 'text-left items-start'
    : isRight
      ? 'text-right items-end w-full'
      : 'text-center items-center';

  return (
    <section className={`relative ${selectedHeightClass} flex items-center overflow-hidden`}>
      {/* Background: Video → Image → Gradient fallback */}
      {/* Background: Video → Image → Gradient fallback */}
      {heroType === 'video' && videoUrl ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          poster={heroImageUrl || undefined}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      ) : (heroType === 'image' || heroType === 'gradient-image') && heroImageUrl ? (
        <div className="absolute inset-0 z-0">
          <Image src={heroImageUrl} alt="Hero Background" fill className="object-cover" priority />
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
            background:
              heroOverlayStyle === 'dark'
                ? `rgba(0, 0, 0, ${heroOverlayOpacity / 100})`
                : heroOverlayStyle === 'gradient-primary'
                  ? `linear-gradient(135deg, hsla(var(--tenant-color-primary-hsl), ${heroOverlayOpacity / 100}) 0%, transparent 100%)`
                  : /* gradient-dark default or cinematic override */
                  `linear-gradient(90deg,
                    rgba(0, 0, 0, ${heroOverlayOpacity / 100}) 0%,
                    rgba(0, 0, 0, ${Math.max(0, (heroOverlayOpacity / 100) - 0.2)}) 40%,
                    rgba(0, 0, 0, ${Math.max(0, (heroOverlayOpacity / 100) - 0.4)}) 100%)`,
          }}
        />
      )}

      {/* Logo Watermark Overlay — large semi-transparent logo */}
      {watermarkUrl && (
        <div className="absolute inset-0 z-[2] pointer-events-none flex items-center justify-center">
          <div className="relative w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] opacity-[0.12] translate-x-[15%]">
            <Image
              src={watermarkUrl}
              alt=""
              fill
              className="object-contain"
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`relative z-10 container mx-auto px-6 sm:px-10 lg:px-16 flex flex-col ${alignClasses}`}>
        {logoUrl && isLeft && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          >
            <div className="relative w-16 h-16 sm:w-20 sm:h-20">
              <Image src={logoUrl} alt={`${businessName} Logo`} fill className="object-contain" />
            </div>
          </motion.div>
        )}

        {!isLeft && logoUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8 flex justify-center"
          >
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-white/40">
              <Image src={logoUrl} alt={`${businessName} Logo`} fill className="object-cover" />
            </div>
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 sm:mb-6 ${isLeft ? 'max-w-2xl' : ''}`}
          style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', lineHeight: 1.1 }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className={`text-base sm:text-lg md:text-xl text-white/80 mb-8 sm:mb-10 ${isLeft ? 'max-w-lg' : 'max-w-2xl mx-auto'}`}
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className={`flex flex-col sm:flex-row gap-4 ${isLeft ? 'justify-start' : 'justify-center'}`}
        >
          <a
            href={consultationUrl}
            className="px-10 py-4 text-lg font-semibold text-white rounded-full transition-all hover:scale-105 inline-block"
            style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
          >
            {ctaText}
          </a>
        </motion.div>
      </div>

      {/* Scroll Indicator (Only show if Height is Full Screen) */}
      {heroHeight === 'full' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white z-10 cursor-pointer"
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
