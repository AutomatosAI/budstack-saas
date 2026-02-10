'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { SectionProps } from '@/lib/types/section-props';

export function CTAWithImage(props: SectionProps) {
  const { tenant, consultationUrl, heroImageUrl, sectionConfig } = props;

  const heading = sectionConfig?.heading || 'Start Your Wellness Journey';
  const subtitle = sectionConfig?.subtitle || 'Our licensed specialists are ready to help you find the right path';
  const ctaText = sectionConfig?.ctaText || 'Book Free Consultation';
  const imageUrl = sectionConfig?.imageUrl || heroImageUrl;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section ref={ref} className="relative py-8 sm:py-10 overflow-hidden">
      {/* Background Image */}
      {imageUrl ? (
        <div className="absolute inset-0 z-0">
          <Image src={imageUrl} alt="CTA Background" fill className="object-cover" />
        </div>
      ) : (
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `linear-gradient(135deg,
              hsl(var(--tenant-color-primary) / 0.9) 0%,
              hsl(var(--tenant-color-secondary) / 0.9) 100%)`,
          }}
        />
      )}

      {/* Overlay */}
      {imageUrl && (
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: `linear-gradient(135deg,
              hsl(var(--tenant-color-primary) / 0.85) 0%,
              hsl(var(--tenant-color-secondary) / 0.85) 100%)`,
          }}
        />
      )}

      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-6"
          style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
        >
          {heading}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-base sm:text-xl text-white/90 mb-6 max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <a
            href={consultationUrl}
            className="inline-block px-12 py-4 text-lg font-bold bg-white rounded-full hover:scale-105 transition-all"
            style={{ color: 'hsl(var(--tenant-color-primary))' }}
          >
            {ctaText}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
