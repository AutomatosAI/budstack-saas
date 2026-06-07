'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Sparkles } from 'lucide-react';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';
import { getIcon } from '@/lib/icon-registry';
import { headerAlignClasses } from '@/lib/templates/section-align';

interface BentoCard {
  icon: string;
  title: string;
  description: string;
  span: 'wide' | 'tall' | 'normal';
  imageUrl: string;
  imageOpacity?: string | number;
}

function clampOpacity(value: unknown, fallback = 20): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(0, num));
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
  const columns = sectionConfig?.columns || 3; // 2 | 3 | 4
  const imageStyle = sectionConfig?.imageStyle || 'background'; // 'background' (opacity-20) | 'cover' (full opacity, no text overlay) | 'featured' (full opacity with text below)

  const colsClass: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  };

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

        <div className={`grid grid-cols-1 ${colsClass[columns] || 'md:grid-cols-3'} gap-4 max-w-6xl mx-auto auto-rows-[minmax(180px,auto)]`}>
          {cards.map((card, index) => {
            const Icon = getIcon(card.icon, Sparkles);
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
                {card.imageUrl && imageStyle === 'background' && (() => {
                  const opacity = clampOpacity(card.imageOpacity, 20) / 100;
                  return (
                    <div className="absolute inset-0 z-0">
                      <Image
                        src={card.imageUrl}
                        alt={card.title}
                        fill
                        className="object-cover transition-opacity duration-300"
                        style={{ opacity }}
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      {opacity > 0.5 && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
                      )}
                    </div>
                  );
                })()}

                {card.imageUrl && imageStyle === 'cover' && (
                  <div className="absolute inset-0 z-0 overflow-hidden">
                    <Image
                      src={card.imageUrl}
                      alt={card.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  </div>
                )}

                {card.imageUrl && imageStyle === 'featured' && (
                  <div className="relative w-full aspect-[4/3] mb-4 overflow-hidden rounded-xl">
                    <Image
                      src={card.imageUrl}
                      alt={card.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                )}

                <div className={`relative z-10 ${imageStyle === 'cover' && card.imageUrl ? 'mt-auto' : ''}`}>
                  {imageStyle !== 'cover' && (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)' }}
                    >
                      <Icon size={24} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
                    </div>
                  )}

                  <h3
                    className="text-xl font-bold mb-2"
                    style={{ color: imageStyle === 'cover' && card.imageUrl ? 'white' : 'hsl(var(--tenant-color-heading))' }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: imageStyle === 'cover' && card.imageUrl ? 'rgba(255,255,255,0.8)' : 'hsl(var(--tenant-color-text))' }}
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
