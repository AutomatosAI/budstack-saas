'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

/**
 * HeroDesignali — Clean modern hero with gradient text, radial glow, and
 * an optional showcase image area. Inspired by 21st.dev "Hero Designali" style.
 *
 * No WebGL — pure CSS gradients and framer-motion. Supports light & dark themes
 * via tenant CSS variables.
 *
 * sectionConfig extras:
 *   imageUrl       — optional showcase image below the CTA
 *   badgeText      — optional badge text (default: subtitle)
 *   glowIntensity  — "subtle" | "medium" | "vivid" (default "medium")
 */
export function HeroDesignali({
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
  const badgeText = (sectionConfig?.badgeText as string) || subtitle;
  const imageUrl = sectionConfig?.imageUrl as string | undefined;

  const intensity = (sectionConfig?.glowIntensity as string) || 'medium';
  const opacityMap: Record<string, number> = {
    subtle: 0.15,
    medium: 0.25,
    vivid: 0.4,
  };
  const glowOpacity = opacityMap[intensity] ?? 0.25;

  // Color overrides
  const primaryOverride = sectionConfig?.primaryColor as string | undefined;
  const accentOverride = sectionConfig?.accentColor as string | undefined;
  const cssOverrides: Record<string, string> = {};
  if (primaryOverride) cssOverrides['--tenant-color-primary'] = primaryOverride;
  if (accentOverride) cssOverrides['--tenant-color-accent'] = accentOverride;

  return (
    <section className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background" style={cssOverrides as React.CSSProperties}>
      {/* Radial glow behind content */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full blur-[120px] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse, hsl(var(--tenant-color-primary) / ${glowOpacity}), transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* Secondary glow */}
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse, hsl(var(--tenant-color-accent) / ${glowOpacity * 0.6}), transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8"
            style={{
              borderColor: 'hsl(var(--tenant-color-primary) / 0.3)',
              backgroundColor: 'hsl(var(--tenant-color-primary) / 0.08)',
            }}
          >
            <Sparkles
              size={14}
              style={{ color: 'hsl(var(--tenant-color-primary))' }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: 'hsl(var(--tenant-color-primary))' }}
            >
              {badgeText}
            </span>
          </motion.div>

          {/* Gradient title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.1] tracking-tight"
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              background: `linear-gradient(180deg, hsl(var(--tenant-color-heading)) 0%, hsl(var(--tenant-color-heading) / 0.5) 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {title}
          </motion.h1>

          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className="text-base sm:text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
              style={{ color: 'hsl(var(--tenant-color-text) / 0.7)' }}
            >
              {description}
            </motion.p>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <a
              href={ctaHref || '#'}
              className="group inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-full text-white transition-all duration-300 hover:scale-105 hover:shadow-xl"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-primary))',
                boxShadow: `0 0 30px hsl(var(--tenant-color-primary) / 0.3)`,
              }}
            >
              {ctaText}
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </a>
            {secondaryCtaText && (
              <a
                href={secondaryCtaHref}
                className="px-8 py-4 text-base font-semibold rounded-full border transition-all duration-300 hover:scale-105"
                style={{
                  borderColor: 'hsl(var(--tenant-color-text) / 0.2)',
                  color: 'hsl(var(--tenant-color-heading))',
                }}
              >
                {secondaryCtaText}
              </a>
            )}
          </motion.div>
        </motion.div>

        {/* Optional showcase image */}
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="relative mt-16 max-w-5xl mx-auto"
          >
            {/* Glow behind image */}
            <div
              className="absolute -inset-4 rounded-2xl blur-2xl"
              style={{
                background: `linear-gradient(135deg, hsl(var(--tenant-color-primary) / 0.15), hsl(var(--tenant-color-accent) / 0.1))`,
              }}
              aria-hidden="true"
            />
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src={imageUrl}
                alt={`${tenant.businessName} showcase`}
                className="w-full h-auto object-cover"
              />
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
