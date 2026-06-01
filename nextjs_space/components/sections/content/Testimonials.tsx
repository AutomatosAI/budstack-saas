'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Star, Quote } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { headerAlignClasses } from '@/lib/templates/section-align';

interface Testimonial {
  quote?: string;
  content?: string;
  author?: string;
  name?: string;
  role?: string;
  rating: number;
}

const defaultItems: Testimonial[] = [
  {
    quote: 'The quality of care and products has genuinely transformed my wellness routine. Highly recommend.',
    author: 'Sarah M.',
    role: 'Verified Patient',
    rating: 5,
  },
  {
    quote: 'Professional, knowledgeable staff who really take the time to understand your needs.',
    author: 'James R.',
    role: 'Verified Patient',
    rating: 5,
  },
  {
    quote: 'Finally found a cannabis provider I can trust. The consultation process was thorough and caring.',
    author: 'Emily K.',
    role: 'Verified Patient',
    rating: 5,
  },
];

export function Testimonials(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'What Our Patients Say';
  const subtitle = sectionConfig?.subtitle || 'Real experiences from real people on their wellness journey';
  const items: Testimonial[] = sectionConfig?.items || defaultItems;
  const backgroundImageUrl = sectionConfig?.backgroundImageUrl || null;
  const overlayOpacity = parseFloat(sectionConfig?.overlayOpacity ?? '0.5');

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="relative py-16 sm:py-20 lg:py-24"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
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

        <div className="grid md:grid-cols-3 gap-4 md:gap-8">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="p-8 rounded-2xl relative"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-background))',
                border: '1px solid hsl(var(--tenant-color-border))',
              }}
            >
              <Quote
                size={32}
                className="mb-4 opacity-20"
                style={{ color: 'hsl(var(--tenant-color-primary))' }}
              />

              <div className="flex gap-1 mb-4">
                {Array.from({ length: item.rating }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    fill="hsl(var(--tenant-color-primary))"
                    style={{ color: 'hsl(var(--tenant-color-primary))' }}
                  />
                ))}
              </div>

              <p
                className="text-base mb-6 leading-relaxed italic"
                style={{ color: 'hsl(var(--tenant-color-text))' }}
              >
                &ldquo;{item.quote || item.content}&rdquo;
              </p>

              <div>
                <p
                  className="font-semibold"
                  style={{ color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {item.author || item.name}
                </p>
                {item.role && (
                  <p className="text-sm" style={{ color: 'hsl(var(--tenant-color-primary))' }}>
                    {item.role}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
