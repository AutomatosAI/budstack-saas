'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

export function HeroMinimal({
  tenant,
  pageContent,
  sectionConfig,
  consultationUrl,
}: SectionProps) {
  const businessName = tenant.businessName;
  const title = sectionConfig?.title || pageContent?.home?.heroTitle || pageContent?.homeHeroTitle || `Welcome to ${businessName}`;
  const subtitle = sectionConfig?.subtitle || pageContent?.home?.heroSubtitle || pageContent?.homeHeroSubtitle || 'Premium Cannabis, Delivered';
  const description = sectionConfig?.description || pageContent?.home?.heroDescription || pageContent?.homeHeroDescription;
  const ctaText = sectionConfig?.ctaText || 'Get Started';

  return (
    <section
      className="min-h-[85vh] flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg,
          hsl(var(--tenant-color-background)) 0%,
          hsl(var(--tenant-color-primary) / 0.08) 100%)`,
      }}
    >
      <div className="container mx-auto px-6 text-center max-w-4xl">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-sm uppercase tracking-widest font-medium mb-6"
          style={{ color: 'hsl(var(--tenant-color-primary))' }}
        >
          {subtitle}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="text-3xl sm:text-5xl md:text-7xl font-bold mb-6 sm:mb-8 leading-tight"
          style={{
            fontFamily: 'var(--tenant-font-heading, sans-serif)',
            color: 'hsl(var(--tenant-color-heading))',
          }}
        >
          {title}
        </motion.h1>

        {description && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base sm:text-lg md:text-xl mb-6 sm:mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ color: 'hsl(var(--tenant-color-text))' }}
          >
            {description}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
        >
          <a
            href={consultationUrl}
            className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-full transition-all hover:scale-105 hover:gap-3"
            style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
          >
            {ctaText}
            <ArrowRight size={18} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
