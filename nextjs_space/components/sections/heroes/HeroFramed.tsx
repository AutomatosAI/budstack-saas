'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

export function HeroFramed({
  tenant,
  heroImageUrl,
  logoUrl,
  pageContent,
  sectionConfig,
  consultationUrl,
}: SectionProps) {
  const businessName = tenant.businessName;
  const title = sectionConfig?.title || pageContent?.home?.heroTitle || `Welcome to ${businessName}`;
  const subtitle = sectionConfig?.subtitle || pageContent?.home?.heroSubtitle || 'Premium Cannabis, Elevated Experience';
  const description = sectionConfig?.description || pageContent?.home?.heroDescription || '';
  const ctaText = sectionConfig?.ctaText || 'Shop Now';
  const ctaHref = sectionConfig?.ctaHref || consultationUrl || '/products';
  const secondaryCtaText = sectionConfig?.secondaryCtaText || '';
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '#about';

  // Frame config
  const framePosition = sectionConfig?.framePosition || 'left'; // 'left' | 'right'
  const frameOpacity = parseFloat(sectionConfig?.frameOpacity ?? '0.85');
  const frameStyle = sectionConfig?.frameStyle || 'solid'; // 'solid' | 'glass' | 'gradient'
  const heroHeight = sectionConfig?.heroHeight || 'large';
  const overlayOpacity = parseFloat(sectionConfig?.overlayOpacity ?? '0.3');

  // Background image — from sectionConfig or heroImageUrl prop
  const bgImage = sectionConfig?.imageUrl || heroImageUrl;

  const heightClass: Record<string, string> = {
    medium: 'min-h-[60vh] py-20',
    large: 'min-h-[80vh] py-32',
    full: 'min-h-[calc(100dvh-4rem)]',
  };
  const selectedHeight = heightClass[heroHeight as string] || heightClass['large'];

  const isLeft = framePosition === 'left';

  // Frame background style
  const getFrameStyle = (): React.CSSProperties => {
    if (frameStyle === 'glass') {
      return {
        backgroundColor: `hsl(var(--tenant-color-background) / ${frameOpacity})`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      };
    }
    if (frameStyle === 'gradient') {
      return {
        background: `linear-gradient(${isLeft ? '135deg' : '225deg'},
          hsl(var(--tenant-color-background) / ${frameOpacity}) 0%,
          hsl(var(--tenant-color-background) / ${Math.max(0, frameOpacity - 0.3)}) 100%)`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      };
    }
    // solid
    return {
      backgroundColor: `hsl(var(--tenant-color-background) / ${frameOpacity})`,
    };
  };

  return (
    <section className={`relative ${selectedHeight} flex items-center overflow-hidden`}>
      {/* Background Image */}
      {bgImage ? (
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
        >
          <Image
            src={bgImage}
            alt="Hero Background"
            fill
            className="object-cover md:object-contain object-center"
            priority
          />
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

      {/* Subtle dark overlay for image contrast */}
      <div
        className="absolute inset-0 z-[1]"
        style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
      />

      {/* Content frame */}
      <div className="relative z-10 container mx-auto px-6 h-full">
        <div className={`flex items-center h-full ${isLeft ? 'justify-start' : 'justify-end'}`}>
          <motion.div
            initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`w-full max-w-xl xl:max-w-2xl rounded-2xl p-8 sm:p-10 md:p-14`}
            style={getFrameStyle()}
          >
            {/* Logo in frame */}
            {logoUrl && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-6"
              >
                <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                  <Image
                    src={logoUrl}
                    alt={`${businessName} Logo`}
                    fill
                    className="object-contain"
                  />
                </div>
              </motion.div>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6"
              style={{
                fontFamily: 'var(--tenant-font-heading, sans-serif)',
                color: 'hsl(var(--tenant-color-heading))',
              }}
            >
              {title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className="text-base sm:text-lg md:text-xl mb-4 leading-relaxed"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
            >
              {subtitle}
            </motion.p>

            {description && (
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.55 }}
                className="text-sm sm:text-base mb-6 leading-relaxed opacity-80"
                style={{ color: 'hsl(var(--tenant-color-text))' }}
              >
                {description}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.65 }}
              className="flex flex-col sm:flex-row gap-3 mt-8"
            >
              {ctaText && (
                <a
                  href={ctaHref}
                  className="px-8 py-3 text-base font-semibold text-white rounded-lg transition-all hover:scale-105 hover:opacity-90 text-center"
                  style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
                >
                  {ctaText}
                </a>
              )}
              {secondaryCtaText && (
                <a
                  href={secondaryCtaHref}
                  className="px-8 py-3 text-base font-semibold rounded-lg transition-all hover:opacity-80 text-center"
                  style={{
                    border: '2px solid hsl(var(--tenant-color-primary))',
                    color: 'hsl(var(--tenant-color-primary))',
                  }}
                >
                  {secondaryCtaText}
                </a>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator for full height */}
      {heroHeight === 'full' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white cursor-pointer z-10"
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
