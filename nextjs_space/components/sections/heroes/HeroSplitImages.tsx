'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Phone } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

/**
 * HeroSplitImages — Two-column hero with text on one side and a
 * dynamic image grid on the other. Inspired by 21st.dev "Hero 01" design.
 *
 * Displays up to 3 images in an asymmetric grid layout. Falls back to
 * brand-coloured placeholder boxes if no images are provided.
 *
 * sectionConfig extras:
 *   imageUrl       — primary large image (left column of grid)
 *   imageUrl2      — top-right image
 *   imageUrl3      — bottom-right image
 *   badgeText      — optional badge above title
 *   layout         — "left" | "right" (text side, default "left")
 */
export function HeroSplitImages({
  tenant,
  pageContent,
  sectionConfig,
  consultationUrl,
}: SectionProps) {
  const title =
    sectionConfig?.title ||
    pageContent?.home?.heroTitle ||
    `Welcome to ${tenant.businessName}`;
  const description =
    sectionConfig?.description ||
    pageContent?.home?.heroDescription ||
    'Discover our curated selection of premium products designed to elevate your experience.';
  const ctaText = sectionConfig?.ctaText || 'Get Started';
  const secondaryCtaText = sectionConfig?.secondaryCtaText || '';
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '/contact';
  const badgeText = (sectionConfig?.badgeText as string) || sectionConfig?.subtitle || pageContent?.home?.heroSubtitle || '';
  const layout = (sectionConfig?.layout as string) || 'left';

  const img1 = sectionConfig?.imageUrl as string | undefined;
  const img2 = sectionConfig?.imageUrl2 as string | undefined;
  const img3 = sectionConfig?.imageUrl3 as string | undefined;

  // Color overrides
  const primaryOverride = sectionConfig?.primaryColor as string | undefined;
  const accentOverride = sectionConfig?.accentColor as string | undefined;
  const cssOverrides: Record<string, string> = {};
  if (primaryOverride) cssOverrides['--tenant-color-primary'] = primaryOverride;
  if (accentOverride) cssOverrides['--tenant-color-accent'] = accentOverride;

  const isTextLeft = layout === 'left';

  const textContent = (
    <motion.div
      initial={{ opacity: 0, x: isTextLeft ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8 }}
      className="flex flex-col justify-center gap-6"
    >
      {badgeText && (
        <div
          className="inline-flex self-start items-center px-3 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)',
            color: 'hsl(var(--tenant-color-primary))',
          }}
        >
          {badgeText}
        </div>
      )}

      <h1
        className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight"
        style={{
          fontFamily: 'var(--tenant-font-heading, sans-serif)',
          color: 'hsl(var(--tenant-color-heading))',
        }}
      >
        {title}
      </h1>

      <p
        className="text-base sm:text-lg max-w-md leading-relaxed"
        style={{ color: 'hsl(var(--tenant-color-text) / 0.7)' }}
      >
        {description}
      </p>

      <div className="flex flex-wrap gap-3 pt-2">
        <a
          href={consultationUrl}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-sm text-white transition-all duration-300 hover:scale-105"
          style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
        >
          {ctaText}
          <ArrowRight size={16} />
        </a>
        {secondaryCtaText && (
          <a
            href={secondaryCtaHref}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-sm border transition-all duration-300 hover:scale-105"
            style={{
              borderColor: 'hsl(var(--tenant-color-text) / 0.2)',
              color: 'hsl(var(--tenant-color-heading))',
            }}
          >
            <Phone size={14} />
            {secondaryCtaText}
          </a>
        )}
      </div>
    </motion.div>
  );

  const imageGrid = (
    <motion.div
      initial={{ opacity: 0, x: isTextLeft ? 30 : -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="grid grid-cols-2 gap-4 h-[400px] lg:h-[500px]"
    >
      {/* Large left image */}
      <div
        className="row-span-2 rounded-2xl overflow-hidden"
        style={{
          backgroundColor: img1 ? undefined : 'hsl(var(--tenant-color-primary) / 0.15)',
        }}
      >
        {img1 ? (
          <img
            src={img1}
            alt="Showcase 1"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-full opacity-30"
              style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
            />
          </div>
        )}
      </div>
      {/* Top-right image */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: img2 ? undefined : 'hsl(var(--tenant-color-secondary) / 0.15)',
        }}
      >
        {img2 ? (
          <img
            src={img2}
            alt="Showcase 2"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-12 h-12 rounded-lg opacity-30"
              style={{ backgroundColor: 'hsl(var(--tenant-color-secondary))' }}
            />
          </div>
        )}
      </div>
      {/* Bottom-right image */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: img3 ? undefined : 'hsl(var(--tenant-color-accent) / 0.15)',
        }}
      >
        {img3 ? (
          <img
            src={img3}
            alt="Showcase 3"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-10 h-10 rounded-full opacity-30"
              style={{ backgroundColor: 'hsl(var(--tenant-color-accent))' }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <section className="relative w-full min-h-screen flex items-center overflow-hidden bg-background" style={cssOverrides as React.CSSProperties}>
      <div className="container mx-auto px-6 md:px-12 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {isTextLeft ? (
            <>
              {textContent}
              {imageGrid}
            </>
          ) : (
            <>
              {imageGrid}
              {textContent}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
