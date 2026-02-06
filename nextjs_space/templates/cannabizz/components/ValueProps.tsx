'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Zap, Shield, Sparkles, Truck } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<any>> = { Zap, Shield, Sparkles, Truck };

interface ValueProp {
  title: string;
  description: string;
  icon: string;
}

interface ValuePropsProps {
  businessName: string;
  heading?: string;
  subtitle?: string;
  items?: ValueProp[];
}

const defaultItems: ValueProp[] = [
  { title: 'Premium Vibes Only', description: 'Lab-tested, top-shelf bud that hits different every time.', icon: 'Sparkles' },
  { title: 'Locked-In Quality', description: 'Every product certified and compliant — no cap.', icon: 'Shield' },
  { title: 'Lightning Fast', description: 'Same-day processing, discreet delivery to your door.', icon: 'Zap' },
  { title: 'Speedy Delivery', description: 'Track your order in real-time. We move quick.', icon: 'Truck' },
];

export default function ValueProps({
  businessName,
  heading = 'Why We Hit Different',
  subtitle = 'Not your average dispensary — we bring the energy, quality, and speed you deserve',
  items = defaultItems,
}: ValuePropsProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-20"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
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

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {items.map((item, index) => {
            const Icon = iconMap[item.icon] || Zap;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ type: 'spring', stiffness: 100, damping: 12, delay: index * 0.08 }}
                className="text-center p-8 rounded-2xl transition-all duration-300 hover:scale-[1.03]"
                style={{
                  backgroundColor: 'hsl(var(--tenant-color-background))',
                  border: '1px solid hsl(var(--tenant-color-border))',
                }}
              >
                <div
                  className="w-16 h-16 mx-auto mb-6 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: 'hsl(var(--tenant-color-primary) / 0.15)',
                    boxShadow: '0 0 20px hsl(var(--tenant-color-primary) / 0.1)',
                  }}
                >
                  <Icon size={32} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
                </div>
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {item.title}
                </h3>
                <p style={{ color: 'hsl(var(--tenant-color-text))', lineHeight: '1.6' }}>
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
