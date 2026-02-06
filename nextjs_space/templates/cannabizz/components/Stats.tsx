'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

interface StatItem {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

interface StatsProps {
  heading?: string;
  items?: StatItem[];
}

const defaultItems: StatItem[] = [
  { value: 10000, suffix: '+', label: 'Customers Served' },
  { value: 200, suffix: '+', label: 'Products Stocked' },
  { value: 50, suffix: '+', label: 'Strains Available' },
  { value: 99, suffix: '%', label: 'Would Recommend' },
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

export default function Stats({
  heading = 'The Numbers Speak',
  items = defaultItems,
}: StatsProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section
      ref={ref}
      className="py-20 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg,
          hsl(var(--tenant-color-primary)) 0%,
          hsl(var(--tenant-color-secondary)) 100%)`,
      }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-1/2 h-1/2 rounded-full blur-[100px] opacity-20"
          style={{ backgroundColor: 'hsl(var(--tenant-color-accent))' }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {heading && (
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: 'spring', stiffness: 100, damping: 12 }}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white text-center mb-16"
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
              transition={{ type: 'spring', stiffness: 100, damping: 12, delay: index * 0.08 }}
              className="text-center"
            >
              <p className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white mb-2">
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
