'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Leaf, FlaskConical, Truck, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';

const iconMap: Record<string, React.ComponentType<any>> = {
  Leaf, FlaskConical, Truck, ShieldCheck,
};

interface TabItem {
  label: string;
  icon: string;
  title: string;
  description: string;
  imageUrl: string;
}

const defaultTabs: TabItem[] = [
  { label: 'Quality', icon: 'Leaf', title: 'Premium Quality Products', description: 'Every product is carefully sourced from certified, sustainable growers who share our commitment to excellence.', imageUrl: '' },
  { label: 'Testing', icon: 'FlaskConical', title: 'Rigorous Lab Testing', description: 'Third-party lab reports for every batch ensure purity, potency, and safety you can trust.', imageUrl: '' },
  { label: 'Delivery', icon: 'Truck', title: 'Fast, Discreet Delivery', description: 'Same-day dispatch in plain packaging. Track your order from warehouse to door.', imageUrl: '' },
  { label: 'Support', icon: 'ShieldCheck', title: 'Expert Guidance', description: 'Certified wellness consultants available to guide your journey with personalised recommendations.', imageUrl: '' },
];

export function TabsShowcase(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'What Sets Us Apart';
  const subtitle = sectionConfig?.subtitle || '';
  const tabs: TabItem[] = sectionConfig?.tabs || defaultTabs;

  const [activeIndex, setActiveIndex] = useState(0);
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const activeTab = tabs[activeIndex];

  return (
    <section
      ref={ref}
      className="py-8 sm:py-10"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-10"
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

        {/* Tab triggers */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          {tabs.map((tab, index) => {
            const Icon = iconMap[tab.icon] || Leaf;
            const isActive = index === activeIndex;
            return (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                style={{
                  backgroundColor: isActive
                    ? 'hsl(var(--tenant-color-primary))'
                    : 'hsl(var(--tenant-color-background))',
                  color: isActive
                    ? 'white'
                    : 'hsl(var(--tenant-color-text))',
                  border: isActive
                    ? 'none'
                    : '1px solid hsl(var(--tenant-color-border))',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </motion.div>

        {/* Tab content */}
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center"
            >
              {/* Text */}
              <div>
                <h3
                  className="text-2xl sm:text-3xl font-bold mb-4"
                  style={{ color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {activeTab.title}
                </h3>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: 'hsl(var(--tenant-color-text))' }}
                >
                  {activeTab.description}
                </p>
              </div>

              {/* Image / Placeholder */}
              <div
                className="relative aspect-[4/3] rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: 'hsl(var(--tenant-color-background))',
                  border: '1px solid hsl(var(--tenant-color-border))',
                }}
              >
                {activeTab.imageUrl ? (
                  <Image
                    src={activeTab.imageUrl}
                    alt={activeTab.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {(() => {
                      const Icon = iconMap[activeTab.icon] || Leaf;
                      return <Icon size={64} style={{ color: 'hsl(var(--tenant-color-primary) / 0.2)' }} />;
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
