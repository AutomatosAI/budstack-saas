'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { SectionProps } from '@/lib/types/section-props';

interface GalleryItem {
  src: string;
  alt: string;
  span?: 'wide' | 'tall' | 'normal';
}

const defaultItems: GalleryItem[] = [
  { src: '/placeholder-1.jpg', alt: 'Gallery image 1', span: 'wide' },
  { src: '/placeholder-2.jpg', alt: 'Gallery image 2', span: 'normal' },
  { src: '/placeholder-3.jpg', alt: 'Gallery image 3', span: 'tall' },
  { src: '/placeholder-4.jpg', alt: 'Gallery image 4', span: 'normal' },
  { src: '/placeholder-5.jpg', alt: 'Gallery image 5', span: 'normal' },
  { src: '/placeholder-6.jpg', alt: 'Gallery image 6', span: 'wide' },
];

export function Gallery(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Our Gallery';
  const subtitle = sectionConfig?.subtitle || 'A glimpse into our world of premium cannabis';
  const items: GalleryItem[] = sectionConfig?.items || defaultItems;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.05 });

  const getSpanClass = (span?: string) => {
    if (span === 'wide') return 'md:col-span-2';
    if (span === 'tall') return 'md:row-span-2';
    return '';
  };

  return (
    <section
      ref={ref}
      className="py-8 sm:py-10"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-8"
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[200px] md:auto-rows-[250px]">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className={`relative rounded-xl overflow-hidden group ${getSpanClass(item.span)}`}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(180deg, transparent 60%, hsl(var(--tenant-color-primary) / 0.6) 100%)`,
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
