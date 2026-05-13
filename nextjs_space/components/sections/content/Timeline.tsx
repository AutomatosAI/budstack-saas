'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { SectionProps } from '@/lib/types/section-props';
import { headerAlignClasses } from '@/lib/section-align';

interface TimelineEntry {
  year: string;
  title: string;
  description: string;
  imageUrl: string;
}

const defaultEntries: TimelineEntry[] = [
  { year: '2020', title: 'Founded', description: 'Started with a vision to make quality wellness accessible to everyone.', imageUrl: '' },
  { year: '2021', title: 'First Store', description: 'Opened our first physical location and launched online ordering.', imageUrl: '' },
  { year: '2022', title: 'Expansion', description: 'Grew to serve over 5,000 customers across multiple regions.', imageUrl: '' },
  { year: '2023', title: 'Innovation', description: 'Launched proprietary formulations and a dedicated research lab.', imageUrl: '' },
  { year: '2024', title: 'Today', description: 'Trusted by thousands with an ever-growing product range and community.', imageUrl: '' },
];

export function Timeline(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Our Journey';
  const subtitle = sectionConfig?.subtitle || '';
  const entries: TimelineEntry[] = sectionConfig?.entries || defaultEntries;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-16 sm:py-20 lg:py-24"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className={`${headerAlignClasses(sectionConfig?.textAlign)} max-w-3xl mb-12`}
        >
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              color: 'hsl(var(--tenant-color-heading))',
            }}
          >
            {heading}
          </h2>
          {subtitle && (
            <p className="text-lg" style={{ color: 'hsl(var(--tenant-color-text))' }}>
              {subtitle}
            </p>
          )}
        </motion.div>

        {/* Vertical timeline */}
        <div className="relative max-w-3xl mx-auto">
          {/* Center line */}
          <div
            className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
            style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.2)' }}
          />

          {entries.map((entry, index) => {
            const isLeft = index % 2 === 0;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                className={`relative flex items-start mb-10 last:mb-0 ${
                  'md:' + (isLeft ? 'flex-row' : 'flex-row-reverse')
                }`}
              >
                {/* Dot */}
                <div
                  className="absolute left-6 md:left-1/2 w-4 h-4 rounded-full -translate-x-1/2 z-10 border-4"
                  style={{
                    backgroundColor: 'hsl(var(--tenant-color-primary))',
                    borderColor: 'hsl(var(--tenant-color-surface))',
                  }}
                />

                {/* Content card */}
                <div className={`ml-14 md:ml-0 md:w-[calc(50%-2rem)] ${isLeft ? 'md:pr-0 md:mr-auto' : 'md:pl-0 md:ml-auto'}`}>
                  <div
                    className="rounded-2xl p-6"
                    style={{
                      backgroundColor: 'hsl(var(--tenant-color-background))',
                      border: '1px solid hsl(var(--tenant-color-border))',
                    }}
                  >
                    <span
                      className="inline-block text-sm font-bold px-3 py-1 rounded-full mb-3"
                      style={{
                        backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)',
                        color: 'hsl(var(--tenant-color-primary))',
                      }}
                    >
                      {entry.year}
                    </span>
                    <h3
                      className="text-lg font-bold mb-2"
                      style={{ color: 'hsl(var(--tenant-color-heading))' }}
                    >
                      {entry.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: 'hsl(var(--tenant-color-text))' }}
                    >
                      {entry.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
