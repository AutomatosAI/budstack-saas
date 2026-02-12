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

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background: Video → Image → Gradient fallback */}
      {videoUrl ? (
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
      ) : heroImageUrl ? (
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

      {/* Gradient Overlay — dark cinematic overlay for video, theme-aware for static */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: videoUrl
            ? `linear-gradient(180deg,
                rgba(0, 0, 0, 0.2) 0%,
                rgba(0, 0, 0, 0.3) 50%,
                rgba(0, 0, 0, 0.6) 100%)`
            : `linear-gradient(180deg,
                hsl(var(--tenant-color-background) / 0.5) 0%,
                hsl(var(--tenant-color-primary) / 0.4) 50%,
                hsl(var(--tenant-color-background) / 0.9) 100%)`,
        }}
      />

      {/* Ambient glow effects */}
      <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden">
        <div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-[120px] opacity-15"
          style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-[100px] opacity-10"
          style={{ backgroundColor: 'hsl(var(--tenant-color-secondary))' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        {logoUrl && (
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
          className="text-3xl sm:text-5xl md:text-7xl font-bold text-white mb-4 sm:mb-6"
          style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-base sm:text-xl md:text-2xl text-white/90 mb-8 sm:mb-12 max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a
            href={consultationUrl}
            className="px-10 py-4 text-lg font-semibold text-white rounded-full transition-all hover:scale-105"
            style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
          >
            {ctaText}
          </a>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white"
      >
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <ChevronDown size={36} />
        </motion.div>
      </motion.div>
    </section>
  );
}
