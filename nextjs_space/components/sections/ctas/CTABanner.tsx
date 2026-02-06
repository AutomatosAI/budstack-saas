'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { SectionProps } from '@/lib/types/section-props';

export function CTABanner(props: SectionProps) {
  const { tenant, consultationUrl, sectionConfig } = props;

  const heading = sectionConfig?.heading || 'Ready to Get Started?';
  const subtitle = sectionConfig?.subtitle || 'Book your free consultation with our medical cannabis specialists today';
  const ctaText = sectionConfig?.ctaText || 'Book Free Consultation';

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section
      ref={ref}
      className="py-10 sm:py-20"
      style={{
        background: `linear-gradient(135deg,
          hsl(var(--tenant-color-primary)) 0%,
          hsl(var(--tenant-color-secondary)) 100%)`,
      }}
    >
      <div className="container mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6"
          style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
        >
          {heading}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-base sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <a
            href={consultationUrl}
            className="inline-block px-10 py-4 text-lg font-semibold rounded-full transition-all hover:scale-105"
            style={{
              backgroundColor: 'white',
              color: 'hsl(var(--tenant-color-primary))',
            }}
          >
            {ctaText}
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-white/70 text-sm"
        >
          No credit card required. 100% confidential.
        </motion.p>
      </div>
    </section>
  );
}
