'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Users, Package, Star, TrendingUp } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

const iconMap: Record<string, React.ComponentType<any>> = {
  Users, Package, Star, TrendingUp,
};

interface StatItem {
  value: number;
  suffix: string;
  label: string;
  icon: string;
}

const defaultItems: StatItem[] = [
  { value: 10000, suffix: '+', label: 'Happy Customers', icon: 'Users' },
  { value: 500, suffix: '+', label: 'Products Available', icon: 'Package' },
  { value: 4.9, suffix: '', label: 'Average Rating', icon: 'Star' },
  { value: 98, suffix: '%', label: 'Satisfaction Rate', icon: 'TrendingUp' },
];

function SpringCounter({ value, suffix, inView }: { value: number; suffix: string; inView: boolean }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 50, damping: 20 });
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (inView) {
      motionValue.set(value);
    }
  }, [inView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      // Handle decimal values (like 4.9)
      if (value % 1 !== 0) {
        setDisplay(latest.toFixed(1));
      } else {
        setDisplay(Math.round(latest).toLocaleString());
      }
    });
    return unsubscribe;
  }, [spring, value]);

  return (
    <span ref={ref}>
      {display}{suffix}
    </span>
  );
}

export function StatsCounter(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || '';
  const items: StatItem[] = sectionConfig?.items || defaultItems;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section
      ref={ref}
      className="py-8 sm:py-10"
      style={{
        background: `linear-gradient(135deg,
          hsl(var(--tenant-color-primary)) 0%,
          hsl(var(--tenant-color-secondary)) 100%)`,
      }}
    >
      <div className="container mx-auto px-6">
        {heading && (
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center mb-10"
            style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
          >
            {heading}
          </motion.h2>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {items.map((item, index) => {
            const Icon = iconMap[item.icon] || TrendingUp;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
                  <Icon size={24} className="text-white" />
                </div>
                <p className="text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-2">
                  <SpringCounter value={item.value} suffix={item.suffix} inView={inView} />
                </p>
                <p className="text-white/80 text-sm sm:text-base">{item.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
