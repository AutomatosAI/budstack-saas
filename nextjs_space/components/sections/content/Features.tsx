'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Leaf, Shield, Truck, Clock, Award, HeartPulse } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

const iconMap: Record<string, React.ComponentType<any>> = {
  Leaf, Shield, Truck, Clock, Award, HeartPulse,
};

interface Feature {
  title: string;
  description: string;
  icon: string;
  imageUrl?: string;
}

const defaultItems: Feature[] = [
  { title: 'Lab Tested', description: 'Every product undergoes rigorous third-party testing.', icon: 'Shield' },
  { title: 'Organic Grown', description: 'Sustainably cultivated without harmful pesticides.', icon: 'Leaf' },
  { title: 'Fast Delivery', description: 'Discreet shipping delivered to your doorstep.', icon: 'Truck' },
  { title: 'Same-Day Service', description: 'Order before noon for same-day processing.', icon: 'Clock' },
  { title: 'Award Winning', description: 'Recognized for excellence in cannabis care.', icon: 'Award' },
  { title: 'Health Focused', description: 'Wellness-first approach with expert guidance.', icon: 'HeartPulse' },
];

const isValidSrc = (src?: string) => !!src && (src.startsWith('http') || src.startsWith('/') || src.startsWith('data:'));

export function Features(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'What Sets Us Apart';
  const subtitle = sectionConfig?.subtitle || 'Built on trust, quality, and a genuine commitment to your wellness';
  const items: Feature[] = sectionConfig?.items || defaultItems;
  const backgroundImage = sectionConfig?.imageUrl;
  const overlayOpacity = parseFloat(sectionConfig?.overlayOpacity ?? '0.7');

  const hasSectionBg = isValidSrc(backgroundImage);

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-16 sm:py-20 lg:py-24 relative overflow-hidden"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
    >
      {/* Section background image */}
      {hasSectionBg && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `hsl(var(--tenant-color-background) / ${overlayOpacity})` }}
          />
        </>
      )}

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
          {items.map((item, index) => {
            const Icon = iconMap[item.icon] || Shield;
            const hasCardBg = isValidSrc(item.imageUrl);

            if (hasCardBg) {
              // Image card style — full background image with title overlay
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="relative rounded-xl overflow-hidden group cursor-pointer"
                  style={{
                    minHeight: '220px',
                    backgroundColor: 'hsl(var(--tenant-color-primary) / 0.06)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl!}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Bottom text strip — solid dark bar just tall enough for title + desc */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/70 to-transparent pt-10 pb-5 px-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={18} className="text-white/80" />
                      <h3
                        className="text-lg font-bold text-white"
                        style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
                      >
                        {item.title}
                      </h3>
                    </div>
                    {item.description && (
                      <p className="text-sm text-white/80 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            }

            // Default card style — icon + text
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="flex gap-4 p-6 rounded-xl transition-all duration-300 hover:shadow-md"
                style={{
                  backgroundColor: hasSectionBg
                    ? 'hsl(var(--tenant-color-surface) / 0.85)'
                    : 'hsl(var(--tenant-color-surface))',
                  border: '1px solid hsl(var(--tenant-color-border))',
                  backdropFilter: hasSectionBg ? 'blur(8px)' : undefined,
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)' }}
                >
                  <Icon size={24} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
                </div>
                <div>
                  <h3
                    className="text-lg font-bold mb-1"
                    style={{ color: 'hsl(var(--tenant-color-heading))' }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                    {item.description}
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
