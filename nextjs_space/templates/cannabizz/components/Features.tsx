'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Leaf, Shield, Truck, Clock, Award, HeartPulse } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<any>> = {
  Leaf, Shield, Truck, Clock, Award, HeartPulse,
};

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface FeaturesProps {
  heading?: string;
  subtitle?: string;
  items?: Feature[];
}

const defaultItems: Feature[] = [
  { title: 'Lab Certified', description: 'Every batch tested by independent labs. Full transparency, always.', icon: 'Shield' },
  { title: 'Clean Grown', description: 'Sustainably cultivated — no nasty pesticides, ever.', icon: 'Leaf' },
  { title: 'Fast Shipping', description: 'Discreet delivery that keeps up with your pace.', icon: 'Truck' },
  { title: 'Same-Day Processing', description: 'Order before noon and we\'re on it immediately.', icon: 'Clock' },
  { title: 'Award Winning', description: 'Recognized for quality, innovation, and customer love.', icon: 'Award' },
  { title: 'Wellness First', description: 'Real guidance from people who actually care about your health.', icon: 'HeartPulse' },
];

export default function Features({
  heading = 'What Makes Us Different',
  subtitle = 'We don\'t just sell — we set the standard',
  items = defaultItems,
}: FeaturesProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-20"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: 'spring', stiffness: 100, damping: 12 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6"
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
          {items.map((item, index) => {
            const Icon = iconMap[item.icon] || Shield;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ type: 'spring', stiffness: 100, damping: 12, delay: index * 0.08 }}
                className="flex gap-4 p-6 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  backgroundColor: 'hsl(var(--tenant-color-surface))',
                  border: '1px solid hsl(var(--tenant-color-border))',
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: 'hsl(var(--tenant-color-primary) / 0.15)',
                    boxShadow: '0 0 15px hsl(var(--tenant-color-primary) / 0.1)',
                  }}
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
