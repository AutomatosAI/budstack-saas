'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

interface Stat {
  value: string;
  label: string;
}

interface AboutProps {
  businessName: string;
  heading?: string;
  content?: string;
  imageUrl?: string | null;
  aboutUrl?: string;
  stats?: Stat[];
}

const defaultStats: Stat[] = [
  { value: '10K+', label: 'Happy Customers' },
  { value: '200+', label: 'Premium Products' },
  { value: '99%', label: 'Satisfaction Rate' },
];

export default function About({
  businessName,
  heading,
  content,
  imageUrl,
  aboutUrl = '/about',
  stats = defaultStats,
}: AboutProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const displayHeading = heading || `The ${businessName} Story`;
  const displayContent =
    content ||
    `We started with one goal: make cannabis accessible, fun, and totally legit. No stuffy vibes, no confusing menus — just top-tier bud, real talk from real people, and a shopping experience that actually slaps. Whether you're a seasoned connoisseur or just getting started, we've got you.`;

  return (
    <section
      ref={ref}
      id="about"
      className="py-20"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
    >
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ type: 'spring', stiffness: 80, damping: 15 }}
            className="relative aspect-[4/3] rounded-2xl overflow-hidden"
          >
            {imageUrl ? (
              <Image src={imageUrl} alt={`About ${businessName}`} fill className="object-cover" />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg,
                    hsl(var(--tenant-color-primary) / 0.3) 0%,
                    hsl(var(--tenant-color-secondary) / 0.2) 50%,
                    hsl(var(--tenant-color-accent) / 0.2) 100%)`,
                }}
              />
            )}
            {/* Neon border glow */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 30px hsl(var(--tenant-color-primary) / 0.2)',
              }}
            />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.1 }}
          >
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6"
              style={{
                fontFamily: 'var(--tenant-font-heading, sans-serif)',
                color: 'hsl(var(--tenant-color-heading))',
              }}
            >
              {displayHeading}
            </h2>
            <p
              className="text-lg mb-8 leading-relaxed"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
            >
              {displayContent}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <p
                    className="text-3xl font-extrabold"
                    style={{ color: 'hsl(var(--tenant-color-primary))' }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <a
              href={aboutUrl}
              className="inline-block px-8 py-3 text-base font-bold text-white rounded-full transition-all hover:scale-105"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-primary))',
                boxShadow: '0 0 15px hsl(var(--tenant-color-primary) / 0.3)',
              }}
            >
              Our Full Story
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
