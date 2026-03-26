'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Play, X } from 'lucide-react';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';

interface GalleryItem {
  type: 'video' | 'image';
  src: string;
  thumbnail: string;
  title: string;
  span: 'wide' | 'normal';
}

const defaultItems: GalleryItem[] = [
  { type: 'video', src: '', thumbnail: '', title: 'Our Story', span: 'wide' },
  { type: 'image', src: '', thumbnail: '', title: 'Lab Process', span: 'normal' },
  { type: 'image', src: '', thumbnail: '', title: 'Product Range', span: 'normal' },
  { type: 'video', src: '', thumbnail: '', title: 'Customer Testimonial', span: 'normal' },
  { type: 'image', src: '', thumbnail: '', title: 'Behind the Scenes', span: 'wide' },
];

export function VideoGallery(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Gallery';
  const subtitle = sectionConfig?.subtitle || '';
  const items: GalleryItem[] = sectionConfig?.items || defaultItems;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [modalItem, setModalItem] = useState<GalleryItem | null>(null);

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

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto auto-rows-[220px]">
          {items.map((item, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              onClick={() => setModalItem(item)}
              className={`relative rounded-2xl overflow-hidden group cursor-pointer ${item.span === 'wide' ? 'md:col-span-2' : ''}`}
              style={{
                backgroundColor: 'hsl(var(--tenant-color-background))',
                border: '1px solid hsl(var(--tenant-color-border))',
              }}
            >
              {(item.thumbnail || item.src) ? (
                <Image
                  src={item.thumbnail || item.src}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes={item.span === 'wide' ? '(max-width: 768px) 100vw, 66vw' : '(max-width: 768px) 100vw, 33vw'}
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--tenant-color-primary) / 0.1) 0%, hsl(var(--tenant-color-secondary) / 0.1) 100%)`,
                  }}
                />
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                {item.type === 'video' && (
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
                    <Play size={24} className="text-black ml-1" fill="currentColor" />
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-sm font-medium">{item.title}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setModalItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative max-w-4xl w-full aspect-video rounded-2xl overflow-hidden bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setModalItem(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </button>

              {modalItem.type === 'video' && modalItem.src ? (
                <video
                  src={modalItem.src}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (modalItem.thumbnail || modalItem.src) ? (
                <Image
                  src={modalItem.thumbnail || modalItem.src}
                  alt={modalItem.title}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 900px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-lg">
                  {modalItem.title}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
