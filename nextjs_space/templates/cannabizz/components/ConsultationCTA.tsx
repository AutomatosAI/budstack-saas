'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

interface ConsultationCTAProps {
  businessName: string;
  consultationUrl?: string;
  heading?: string;
  subtitle?: string;
  ctaText?: string;
  imageUrl?: string | null;
}

export default function ConsultationCTA({
  businessName,
  consultationUrl = '/consultation',
  heading = 'Ready to Level Up?',
  subtitle = 'Book a free consultation and let our specialists hook you up with the perfect plan',
  ctaText = 'Book Free Consultation',
  imageUrl,
}: ConsultationCTAProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section ref={ref} className="relative py-12 sm:py-24 overflow-hidden">
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
              hsl(var(--tenant-color-primary) / 0.95) 0%,
              hsl(var(--tenant-color-secondary) / 0.85) 50%,
              hsl(var(--tenant-color-accent) / 0.9) 100%)`,
          }}
        />
      )}

      {/* Overlay */}
      {imageUrl && (
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: `linear-gradient(135deg,
              hsl(var(--tenant-color-primary) / 0.9) 0%,
              hsl(var(--tenant-color-secondary) / 0.85) 100%)`,
          }}
        />
      )}

      {/* Neon ambient glow */}
      <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden">
        <div
          className="absolute -top-1/3 -right-1/4 w-2/3 h-2/3 rounded-full blur-[120px] opacity-25"
          style={{ backgroundColor: 'hsl(var(--tenant-color-accent))' }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: 'spring', stiffness: 100, damping: 12 }}
          className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white mb-6"
          style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
        >
          {heading}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.08 }}
          className="text-base sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.16 }}
        >
          <a
            href={consultationUrl}
            className="inline-block px-12 py-4 text-lg font-bold bg-white rounded-full hover:scale-105 transition-all"
            style={{
              color: 'hsl(var(--tenant-color-primary))',
              boxShadow: '0 0 30px rgba(255,255,255,0.2)',
            }}
          >
            {ctaText}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
