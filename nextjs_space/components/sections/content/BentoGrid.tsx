'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Leaf, Shield, Zap, Heart, Sparkles, Package } from 'lucide-react';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';

const iconMap: Record<string, React.ComponentType<any>> = {
  Leaf, Shield, Zap, Heart, Sparkles, Package,
};

interface BentoCard {
  icon: string;
  title: string;
  description: string;
  span: 'wide' | 'tall' | 'normal';
  imageUrl: string;
}

const defaultCards: BentoCard[] = [
  { icon: 'Shield', title: 'Lab Tested', description: 'Every product undergoes rigorous third-party testing for purity and potency.', span: 'wide', imageUrl: '' },
  { icon: 'Leaf', title: 'Organic Growing', description: 'Sustainably cultivated without harmful pesticides.', span: 'normal', imageUrl: '' },
  { icon: 'Zap', title: 'Fast Delivery', description: 'Same-day dispatch on orders before 2pm.', span: 'normal', imageUrl: '' },
  { icon: 'Heart', title: 'Expert Support', description: 'Dedicated wellness consultants available to guide your journey from start to finish.', span: 'tall', imageUrl: '' },
  { icon: 'Sparkles', title: 'Premium Quality', description: 'Sourced from trusted, certified growers.', span: 'normal', imageUrl: '' },
  { icon: 'Package', title: 'Discreet Packaging', description: 'Plain, unmarked packaging for your privacy.', span: 'normal', imageUrl: '' },
];

function getSpanClass(span: string): string {
  switch (span) {
    case 'wide': return 'md:col-span-2';
    case 'tall': return 'md:row-span-2';
    default: return '';
  }
}

export function BentoGrid(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Why We Stand Out';
  const subtitle = sectionConfig?.subtitle || '';
  const cards: BentoCard[] = sectionConfig?.cards || defaultCards;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-8 sm:py-10"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto auto-rows-[minmax(180px,auto)]">
          {cards.map((card, index) => {
            const Icon = iconMap[card.icon] || Sparkles;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className={`relative rounded-2xl p-6 overflow-hidden group transition-shadow duration-300 hover:shadow-xl flex flex-col justify-between ${getSpanClass(card.span)}`}
                style={{
                  backgroundColor: 'hsl(var(--tenant-color-background))',
                  border: '1px solid hsl(var(--tenant-color-border))',
                }}
              >
                {card.imageUrl && (
                  <div className="absolute inset-0 z-0">
                    <Image
                      src={card.imageUrl}
                      alt={card.title}
                      fill
                      className="object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-300"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                )}

                <div className="relative z-10">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)' }}
                  >
                    <Icon size={24} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
                  </div>

                  <h3
                    className="text-xl font-bold mb-2"
                    style={{ color: 'hsl(var(--tenant-color-heading))' }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'hsl(var(--tenant-color-text))' }}
                  >
                    {card.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
