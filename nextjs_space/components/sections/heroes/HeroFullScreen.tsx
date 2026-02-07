'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

export function HeroFullScreen({
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
  const description = sectionConfig?.description || pageContent?.home?.heroDescription || pageContent?.homeHeroDescription;
  const ctaText = sectionConfig?.ctaText || 'Book Consultation';
  const secondaryCtaText = sectionConfig?.secondaryCtaText || 'Learn More';
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '#about';

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background: Image if available, otherwise rich gradient */}
      {heroImageUrl ? (
        <div className="absolute inset-0 z-0">
          <Image
            src={heroImageUrl}
            alt="Hero Background"
            fill
            className="object-cover"
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

      {/* Gradient Overlay — works on both image and gradient backgrounds */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: `linear-gradient(180deg,
            hsl(var(--tenant-color-primary) / 0.6) 0%,
            hsl(var(--tenant-color-background) / 0.95) 100%)`,
        }}
      />

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

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        {logoUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-6 sm:mb-8 flex justify-center"
          >
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
              <Image src={logoUrl} alt={`${businessName} Logo`} fill className="object-cover" />
            </div>
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-3xl sm:text-5xl md:text-7xl font-bold text-white mb-4 sm:mb-6"
          style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-base sm:text-xl md:text-2xl text-white/90 mb-4 max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>

        {description && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-sm sm:text-lg text-white/75 mb-6 sm:mb-10 max-w-xl mx-auto"
          >
            {description}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8"
        >
          <a
            href={consultationUrl}
            className="px-8 py-3 text-base font-semibold text-white rounded-full transition-all hover:scale-105"
            style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
          >
            {ctaText}
          </a>
          <a
            href={secondaryCtaHref}
            className="px-8 py-3 text-base font-semibold border-2 border-white text-white rounded-full hover:bg-white/10 transition-all"
          >
            {secondaryCtaText}
          </a>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
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
    </section>
  );
}
