'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Star } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

const defaultAvatars = [
  '/avatars/1.jpg',
  '/avatars/2.jpg',
  '/avatars/3.jpg',
  '/avatars/4.jpg',
  '/avatars/5.jpg',
];

export function SocialProof(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || '';
  const avatars: string[] = sectionConfig?.avatars || defaultAvatars;
  const count = sectionConfig?.count || 10000;
  const label = sectionConfig?.label || 'Happy Customers';
  const rating = sectionConfig?.rating || 4.9;
  const testimonial = sectionConfig?.testimonial || '';
  const testimonialAuthor = sectionConfig?.testimonialAuthor || '';

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  const displayCount = count >= 1000
    ? `${Math.floor(count / 1000)}K+`
    : `${count}+`;

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
          className="flex flex-col items-center text-center max-w-2xl mx-auto"
        >
          {heading && (
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8"
              style={{
                fontFamily: 'var(--tenant-font-heading, sans-serif)',
                color: 'hsl(var(--tenant-color-heading))',
              }}
            >
              {heading}
            </h2>
          )}

          {/* Avatar stack */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex -space-x-3">
              {avatars.slice(0, 5).map((avatar, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.3, delay: index * 0.08 }}
                  className="w-10 h-10 rounded-full border-2 overflow-hidden"
                  style={{
                    borderColor: 'hsl(var(--tenant-color-surface))',
                    backgroundColor: 'hsl(var(--tenant-color-primary) / 0.15)',
                  }}
                >
                  {avatar && !avatar.startsWith('/avatars/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-xs font-bold"
                      style={{ color: 'hsl(var(--tenant-color-primary))' }}
                    >
                      {String.fromCharCode(65 + index)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="text-left">
              <div className="flex items-center gap-1 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    fill={i < Math.round(rating) ? 'hsl(var(--tenant-color-primary))' : 'transparent'}
                    style={{
                      color: i < Math.round(rating)
                        ? 'hsl(var(--tenant-color-primary))'
                        : 'hsl(var(--tenant-color-border))',
                    }}
                  />
                ))}
                <span
                  className="text-sm font-semibold ml-1"
                  style={{ color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {rating}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                <span className="font-bold" style={{ color: 'hsl(var(--tenant-color-heading))' }}>
                  {displayCount}
                </span>{' '}
                {label}
              </p>
            </div>
          </div>

          {/* Optional testimonial */}
          {testimonial && (
            <motion.blockquote
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 p-6 rounded-2xl max-w-lg"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-background))',
                border: '1px solid hsl(var(--tenant-color-border))',
              }}
            >
              <p
                className="text-base italic leading-relaxed"
                style={{ color: 'hsl(var(--tenant-color-text))' }}
              >
                &ldquo;{testimonial}&rdquo;
              </p>
              {testimonialAuthor && (
                <cite
                  className="block mt-3 text-sm font-medium not-italic"
                  style={{ color: 'hsl(var(--tenant-color-heading))' }}
                >
                  — {testimonialAuthor}
                </cite>
              )}
            </motion.blockquote>
          )}
        </motion.div>
      </div>
    </section>
  );
}
