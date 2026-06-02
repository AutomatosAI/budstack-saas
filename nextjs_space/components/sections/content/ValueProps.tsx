'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Star } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getIcon } from '@/lib/icon-registry';
import { headerAlignClasses } from '@/lib/templates/section-align';

interface ValueProp {
  title: string;
  description: string;
  icon: string;
}

const defaultItems: ValueProp[] = [
  { title: 'Premium Quality', description: 'Carefully sourced and lab-tested products you can trust.', icon: 'Star' },
  { title: 'Expert Guidance', description: 'Professional support from licensed cannabis specialists.', icon: 'Shield' },
  { title: 'Holistic Care', description: 'Whole-person wellness approach to your health journey.', icon: 'Heart' },
  { title: 'Easy Access', description: 'Convenient online ordering with discreet delivery.', icon: 'Check' },
];

export function ValueProps(props: SectionProps) {
  const { sectionConfig, valueProps } = props;
  const heading = sectionConfig?.heading || 'Why Choose Us';
  const subtitle = sectionConfig?.subtitle || 'Experience the difference with our commitment to quality and care';
  const items: ValueProp[] = sectionConfig?.items || valueProps || defaultItems;

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
          className={`${headerAlignClasses(sectionConfig?.textAlign)} max-w-3xl mb-8`}
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
          <p className="text-lg" style={{ color: 'hsl(var(--tenant-color-text))' }}>
            {subtitle}
          </p>
        </motion.div>

        <div className={`grid md:grid-cols-2 ${items.length === 3 ? 'lg:grid-cols-3 max-w-5xl mx-auto' : 'lg:grid-cols-4'} gap-8`}>
          {items.map((item, index) => {
            const Icon = getIcon(item.icon, Star);
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center p-8 rounded-2xl transition-all duration-300 hover:shadow-lg"
                style={{
                  backgroundColor: 'hsl(var(--tenant-color-background))',
                  border: '1px solid hsl(var(--tenant-color-border))',
                }}
              >
                <div
                  className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)' }}
                >
                  <Icon size={32} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
                </div>
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {item.title}
                </h3>
                <p style={{ color: 'hsl(var(--tenant-color-text))', lineHeight: '1.6' }}>
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
