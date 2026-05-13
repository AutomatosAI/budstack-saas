'use client';

import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { SectionProps } from '@/lib/types/section-props';
import { headerAlignClasses } from '@/lib/section-align';

export function Parallax(props: SectionProps) {
  const { sectionConfig, consultationUrl } = props;
  const heading = sectionConfig?.heading || 'Experience the Difference';
  const description = sectionConfig?.description || 'Premium quality products crafted with care for your wellness journey.';
  const imageUrl = sectionConfig?.imageUrl || '';
  const ctaText = sectionConfig?.ctaText || '';
  const ctaHref = sectionConfig?.ctaHref || consultationUrl || '#';
  const overlayOpacity = sectionConfig?.overlayOpacity ?? 0.5;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ minHeight: '60vh' }}
    >
      {/* Parallax background */}
      <motion.div
        className="absolute inset-0 -top-[10%] -bottom-[10%]"
        style={{ y }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg,
                hsl(var(--tenant-color-primary) / 0.8) 0%,
                hsl(var(--tenant-color-secondary) / 0.8) 100%)`,
            }}
          />
        )}
      </motion.div>

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
      />

      {/* Content */}
      <div ref={ref} className="relative z-10 flex items-center justify-center min-h-[60vh] py-16 sm:py-24">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className={`max-w-3xl ${headerAlignClasses(sectionConfig?.textAlign)}`}
          >
            <h2
              className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-6"
              style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
            >
              {heading}
            </h2>
            <p className="text-lg sm:text-xl text-white/85 mb-8 max-w-2xl mx-auto leading-relaxed">
              {description}
            </p>
            {ctaText && (
              <motion.a
                href={ctaHref}
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="inline-block px-10 py-4 text-lg font-semibold rounded-full transition-all hover:scale-105"
                style={{
                  backgroundColor: 'hsl(var(--tenant-color-primary))',
                  color: 'white',
                }}
              >
                {ctaText}
              </motion.a>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
