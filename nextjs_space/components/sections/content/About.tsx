'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { SectionProps } from '@/lib/types/section-props';

interface Stat {
  value: string;
  label: string;
}

const defaultStats: Stat[] = [
  { value: '5,000+', label: 'Happy Patients' },
  { value: '50+', label: 'Products' },
  { value: '10+', label: 'Years Experience' },
];

export function About(props: SectionProps) {
  const { tenant, aboutUrl, sectionConfig, pageContent } = props;
  const businessName = tenant.businessName;
  const heading = sectionConfig?.heading || `About ${businessName}`;
  const content =
    sectionConfig?.content ||
    pageContent?.about?.content ||
    pageContent?.aboutMission ||
    `We are dedicated to providing the highest quality medical cannabis products and personalized care. Our team of licensed professionals is committed to helping you find the right wellness solutions for your unique needs.`;
  const imageUrl = sectionConfig?.imageUrl || null;
  const stats: Stat[] = sectionConfig?.stats || defaultStats;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      id="about"
      className="py-20"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
    >
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="relative aspect-[4/3] rounded-2xl overflow-hidden"
          >
            {imageUrl ? (
              <Image src={imageUrl} alt={`About ${businessName}`} fill className="object-cover" />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg,
                    hsl(var(--tenant-color-primary) / 0.2) 0%,
                    hsl(var(--tenant-color-secondary) / 0.2) 100%)`,
                }}
              />
            )}
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
              style={{
                fontFamily: 'var(--tenant-font-heading, sans-serif)',
                color: 'hsl(var(--tenant-color-heading))',
              }}
            >
              {heading}
            </h2>
            <p
              className="text-base sm:text-lg mb-8 leading-relaxed"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
            >
              {content}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <p
                    className="text-3xl font-bold"
                    style={{ color: 'hsl(var(--tenant-color-primary))' }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <a
              href={aboutUrl}
              className="inline-block px-8 py-3 text-base font-semibold text-white rounded-lg transition-all hover:opacity-90"
              style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
            >
              Learn More About Us
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
