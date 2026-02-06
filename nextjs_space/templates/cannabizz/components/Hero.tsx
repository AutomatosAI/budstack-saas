'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface HeroFullScreenProps {
  businessName: string;
  title?: string;
  subtitle?: string;
  description?: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  consultationUrl?: string;
  ctaText?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
}

export default function HeroFullScreen({
  businessName,
  title,
  subtitle,
  description,
  heroImageUrl,
  logoUrl,
  consultationUrl = '/consultation',
  ctaText = 'Get Started',
  secondaryCtaText = 'Explore',
  secondaryCtaHref = '#about',
}: HeroFullScreenProps) {
  const displayTitle = title || `Welcome to ${businessName}`;
  const displaySubtitle = subtitle || 'Your Vibe. Your Bud. Your Way.';

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
            hsl(var(--tenant-color-primary) / 0.7) 0%,
            hsl(var(--tenant-color-background) / 0.95) 100%)`,
        }}
      />

      {/* Neon glow ambient effects */}
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
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="mb-8 flex justify-center"
          >
            <div
              className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-2xl"
              style={{
                border: '3px solid hsl(var(--tenant-color-primary) / 0.5)',
                boxShadow: '0 0 30px hsl(var(--tenant-color-primary) / 0.3), 0 0 60px hsl(var(--tenant-color-primary) / 0.15)',
              }}
            >
              <Image src={logoUrl} alt={`${businessName} Logo`} fill className="object-cover" />
            </div>
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.2 }}
          className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold text-white mb-6"
          style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
        >
          {displayTitle}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.35 }}
          className="text-base sm:text-xl md:text-2xl text-white/90 mb-4 max-w-2xl mx-auto"
        >
          {displaySubtitle}
        </motion.p>

        {description && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.45 }}
            className="text-sm sm:text-lg text-white/70 mb-10 max-w-xl mx-auto"
          >
            {description}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.55 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8"
        >
          <a
            href={consultationUrl}
            className="px-10 py-4 text-base font-bold text-white rounded-full transition-all hover:scale-105 hover:shadow-lg"
            style={{
              backgroundColor: 'hsl(var(--tenant-color-primary))',
              boxShadow: '0 0 20px hsl(var(--tenant-color-primary) / 0.4)',
            }}
          >
            {ctaText}
          </a>
          <a
            href={secondaryCtaHref}
            className="px-10 py-4 text-base font-bold border-2 rounded-full hover:bg-white/10 transition-all"
            style={{
              borderColor: 'hsl(var(--tenant-color-secondary))',
              color: 'hsl(var(--tenant-color-secondary))',
            }}
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
        className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer"
        style={{ color: 'hsl(var(--tenant-color-secondary))' }}
        onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
      >
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <ChevronDown size={36} />
        </motion.div>
      </motion.div>
    </section>
  );
}
