'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { SectionProps } from '@/lib/types/section-props';
import { textAlignClass } from '@/lib/section-align';

interface StatItem {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

const defaultItems: StatItem[] = [
  { value: 5000, suffix: '+', label: 'Happy Patients' },
  { value: 50, suffix: '+', label: 'Products Available' },
  { value: 10, suffix: '+', label: 'Years Experience' },
  { value: 98, suffix: '%', label: 'Satisfaction Rate' },
];

function AnimatedNumber({ value, suffix = '', prefix = '', inView }: StatItem & { inView: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, value]);

  return (
    <span>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

export function Stats(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'By the Numbers';
  const backgroundImageUrl = sectionConfig?.backgroundImageUrl || null;
  const overlayOpacity = parseFloat(sectionConfig?.overlayOpacity ?? '0.5');
  const items: StatItem[] = sectionConfig?.items || defaultItems;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section
      ref={ref}
      className="relative py-16 sm:py-20 lg:py-24"
      style={{
        background: `linear-gradient(135deg,
          hsl(var(--tenant-color-primary)) 0%,
          hsl(var(--tenant-color-secondary)) 100%)`,
      }}
    >
      {backgroundImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
          <div
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: `hsl(var(--tenant-color-background) / ${overlayOpacity})` }}
          />
        </>
      )}
      <div className="relative z-10 container mx-auto px-6">
        {heading && (
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-8 ${textAlignClass(sectionConfig?.textAlign)}`}
            style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
          >
            {heading}
          </motion.h2>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="text-center"
            >
              <p className="text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-2">
                <AnimatedNumber {...item} inView={inView} />
              </p>
              <p className="text-white/80 text-lg">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
