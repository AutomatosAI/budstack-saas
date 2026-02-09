'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Calendar, Video, MessageCircle } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

const steps = [
  { icon: Calendar, title: '1. Book Online', description: 'Schedule a convenient time' },
  { icon: Video, title: '2. Consultation', description: 'Meet with our experts' },
  { icon: MessageCircle, title: '3. Get Prescription', description: 'Receive your personalized plan' },
];

export function CTASplit(props: SectionProps) {
  const { tenant, consultationUrl, heroImageUrl, sectionConfig } = props;

  const heading = sectionConfig?.heading || 'Ready to Get Started?';
  const subtitle = sectionConfig?.subtitle || 'Three simple steps to begin your wellness journey';
  const ctaText = sectionConfig?.ctaText || 'Book Free Consultation';
  const imageUrl = sectionConfig?.imageUrl || heroImageUrl;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-12 sm:py-16"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
    >
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
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
            <p className="text-base sm:text-lg mb-10" style={{ color: 'hsl(var(--tenant-color-text))' }}>
              {subtitle}
            </p>

            <div className="space-y-6 mb-10">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                    className="flex items-start gap-4"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)' }}
                    >
                      <Icon size={24} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
                    </div>
                    <div>
                      <h3
                        className="font-bold text-lg"
                        style={{ color: 'hsl(var(--tenant-color-heading))' }}
                      >
                        {step.title}
                      </h3>
                      <p style={{ color: 'hsl(var(--tenant-color-text))' }}>{step.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <a
              href={consultationUrl}
              className="inline-block px-10 py-4 text-lg font-semibold text-white rounded-full transition-all hover:scale-105"
              style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
            >
              {ctaText}
            </a>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative aspect-square rounded-2xl overflow-hidden"
          >
            {imageUrl ? (
              <Image src={imageUrl} alt="Consultation" fill className="object-cover" />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg,
                    hsl(var(--tenant-color-primary) / 0.15) 0%,
                    hsl(var(--tenant-color-accent) / 0.15) 100%)`,
                }}
              />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
