'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

/**
 * HeroAurora — Full-screen hero with an animated aurora/sunset CSS gradient.
 *
 * No WebGL or canvas — pure CSS gradient animation + framer-motion. Lightweight
 * and works everywhere. Uses brand colours via CSS custom properties.
 *
 * sectionConfig extras:
 *   auroraIntensity — "subtle" | "medium" | "vivid" (default "medium")
 */
export function HeroAurora({
  tenant,
  pageContent,
  sectionConfig,
  consultationUrl,
}: SectionProps) {
  const title =
    sectionConfig?.title ||
    pageContent?.home?.heroTitle ||
    `Welcome to ${tenant.businessName}`;
  const subtitle =
    sectionConfig?.subtitle ||
    pageContent?.home?.heroSubtitle ||
    'Premium Cannabis, Delivered';
  const description =
    sectionConfig?.description || pageContent?.home?.heroDescription;
  const ctaText = sectionConfig?.ctaText || 'Get Started';
  const ctaHref = sectionConfig?.ctaHref || consultationUrl;
  const secondaryCtaText = sectionConfig?.secondaryCtaText;
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '/products';

  const intensity = (sectionConfig?.auroraIntensity as string) || 'medium';
  const opacityMap: Record<string, number> = {
    subtle: 0.25,
    medium: 0.4,
    vivid: 0.6,
  };
  const auroraOpacity = opacityMap[intensity] ?? 0.4;

  // Color overrides
  const primaryOverride = sectionConfig?.primaryColor as string | undefined;
  const accentOverride = sectionConfig?.accentColor as string | undefined;
  const cssOverrides: Record<string, string> = {};
  if (primaryOverride) cssOverrides['--tenant-color-primary'] = primaryOverride;
  if (accentOverride) cssOverrides['--tenant-color-accent'] = accentOverride;

  // Split title into words for per-letter animation
  const titleWords = title.split(' ');

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-background" style={cssOverrides as React.CSSProperties}>
      {/* Aurora gradient layers */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ opacity: auroraOpacity }}
        aria-hidden="true"
      >
        {/* Slow-moving aurora sweep */}
        <motion.div
          className="absolute inset-[-100%]"
          style={{
            background: `repeating-linear-gradient(100deg,
              hsl(var(--tenant-color-primary)) 10%,
              hsl(var(--tenant-color-secondary)) 15%,
              hsl(var(--tenant-color-accent)) 20%,
              hsl(var(--tenant-color-primary)) 25%,
              hsl(var(--tenant-color-secondary)) 30%)`,
            backgroundSize: '300% 100%',
            filter: 'blur(80px)',
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Secondary texture layer with mix-blend-difference */}
        <motion.div
          className="absolute inset-[-10px]"
          style={{
            background: `
              repeating-linear-gradient(100deg,
                hsl(var(--tenant-color-primary) / 0.1) 0%,
                hsl(var(--tenant-color-primary) / 0.1) 7%,
                transparent 10%,
                transparent 12%,
                hsl(var(--tenant-color-primary) / 0.1) 16%),
              repeating-linear-gradient(100deg,
                hsl(var(--tenant-color-primary)) 10%,
                hsl(var(--tenant-color-secondary)) 15%,
                hsl(var(--tenant-color-accent)) 20%,
                hsl(var(--tenant-color-primary)) 25%,
                hsl(var(--tenant-color-secondary)) 30%)`,
            backgroundSize: '200%, 100%',
            backgroundPosition: '50% 50%, 50% 50%',
            mixBlendMode: 'difference',
          }}
          animate={{
            backgroundPosition: [
              '50% 50%, 50% 50%',
              '100% 50%, 150% 50%',
              '50% 50%, 50% 50%',
            ],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, hsl(var(--tenant-color-background) / 0.8) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="max-w-5xl mx-auto"
        >
          {/* Animated title — per-letter stagger */}
          <h1
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-8 tracking-tight"
            style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
          >
            {titleWords.map((word: string, wordIndex: number) => (
              <span
                key={wordIndex}
                className="inline-block mr-3 sm:mr-4 last:mr-0 mb-2"
              >
                {word.split('').map((letter: string, letterIndex: number) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={{ y: 80, opacity: 0, filter: 'blur(6px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    transition={{
                      delay: wordIndex * 0.1 + letterIndex * 0.03,
                      type: 'spring',
                      stiffness: 100,
                      damping: 15,
                    }}
                    className="inline-block"
                    style={{
                      color: 'hsl(var(--tenant-color-heading))',
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          {/* Eyebrow / subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-sm uppercase tracking-widest font-medium mb-6"
            style={{ color: 'hsl(var(--tenant-color-primary))' }}
          >
            {subtitle}
          </motion.p>

          {description && (
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="text-lg sm:text-xl md:text-2xl mb-10 max-w-3xl mx-auto leading-relaxed"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
            >
              {description}
            </motion.p>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <a
              href={ctaHref || '#'}
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-full text-white transition-all duration-300 hover:scale-105 hover:shadow-xl hover:gap-3"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-primary))',
              }}
            >
              {ctaText}
              <ArrowRight size={18} />
            </a>
            {secondaryCtaText && (
              <a
                href={secondaryCtaHref}
                className="px-8 py-4 text-base font-semibold rounded-full transition-all duration-300 hover:scale-105"
                style={{
                  backgroundColor: 'hsl(var(--tenant-color-secondary))',
                  color: 'hsl(var(--tenant-color-heading))',
                }}
              >
                {secondaryCtaText}
              </a>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
