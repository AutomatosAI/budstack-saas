'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';

interface LogoItem {
  src: string;
  alt: string;
}

const defaultLogos: LogoItem[] = [
  { src: '/logos/partner-1.svg', alt: 'Partner 1' },
  { src: '/logos/partner-2.svg', alt: 'Partner 2' },
  { src: '/logos/partner-3.svg', alt: 'Partner 3' },
  { src: '/logos/partner-4.svg', alt: 'Partner 4' },
  { src: '/logos/partner-5.svg', alt: 'Partner 5' },
  { src: '/logos/partner-6.svg', alt: 'Partner 6' },
];

export function LogoMarquee(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Trusted By';
  const rawLogos: any[] = sectionConfig?.logos || defaultLogos;
  // Normalize: schema uses { src, alt } but older data may use { imageUrl, name }
  const logos: LogoItem[] = rawLogos.map((l) => ({
    src: l.src || l.imageUrl || '',
    alt: l.alt || l.name || 'Logo',
  })).filter((l) => l.src || l.alt);
  const speed = sectionConfig?.speed || 60;
  const reverse = sectionConfig?.reverse || false;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  // Double the logos for seamless loop
  const loopLogos = logos.length > 0 ? [...logos, ...logos] : [];
  const duration = logos.length > 0 ? logos.length * (100 / speed) : 10;

  return (
    <section
      ref={ref}
      className="py-16 sm:py-20 lg:py-24 overflow-hidden"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
    >
      <div className="container mx-auto px-6">
        {heading && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center text-sm font-medium uppercase tracking-widest mb-8"
            style={{ color: 'hsl(var(--tenant-color-text) / 0.5)' }}
          >
            {heading}
          </motion.p>
        )}
      </div>

      {/* Marquee track */}
      <div className="relative overflow-hidden">
        {/* Edge fade masks */}
        <div
          className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to right, hsl(var(--tenant-color-surface)), transparent)`,
          }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to left, hsl(var(--tenant-color-surface)), transparent)`,
          }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-12"
          style={{
            animation: `marquee-scroll ${duration}s linear infinite ${reverse ? 'reverse' : ''}`,
          }}
        >
          {loopLogos.map((logo, index) => (
            <div
              key={index}
              className="shrink-0 h-10 w-32 relative grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            >
              {!logo.src || logo.src.startsWith('/logos/') ? (
                <div
                  className="w-full h-full rounded-lg flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: 'hsl(var(--tenant-color-background))',
                    color: 'hsl(var(--tenant-color-text))',
                    border: '1px solid hsl(var(--tenant-color-border))',
                  }}
                >
                  {logo.alt}
                </div>
              ) : (
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  fill
                  className="object-contain"
                  sizes="128px"
                />
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Inject keyframes */}
      <style jsx>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
