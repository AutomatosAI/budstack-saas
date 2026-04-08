'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ClipboardList, Search, Truck, CheckCircle } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

const iconMap: Record<string, React.ComponentType<any>> = {
  ClipboardList, Search, Truck, CheckCircle,
};

interface Step {
  title: string;
  description: string;
  icon: string;
}

const defaultSteps: Step[] = [
  { title: 'Browse', description: 'Explore our curated selection of premium products.', icon: 'Search' },
  { title: 'Select', description: 'Choose the products that suit your needs.', icon: 'ClipboardList' },
  { title: 'Order', description: 'Place your order with fast, discreet delivery.', icon: 'Truck' },
  { title: 'Enjoy', description: 'Receive your order and start your wellness journey.', icon: 'CheckCircle' },
];

export function ProcessSteps(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'How It Works';
  const subtitle = sectionConfig?.subtitle || 'Getting started is simple';
  const orientation = sectionConfig?.orientation || 'horizontal';
  const steps: Step[] = sectionConfig?.steps || defaultSteps;
  const backgroundImageUrl = sectionConfig?.backgroundImageUrl || null;
  const overlayOpacity = parseFloat(sectionConfig?.overlayOpacity ?? '0.5');

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const isHorizontal = orientation === 'horizontal';

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

        <div className={`relative ${isHorizontal ? 'flex flex-col md:flex-row items-start justify-center gap-0' : 'flex flex-col items-start max-w-2xl mx-auto gap-0'}`}>
          {steps.map((step, index) => {
            const Icon = iconMap[step.icon] || CheckCircle;
            const isLast = index === steps.length - 1;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className={`relative flex ${isHorizontal ? 'flex-col items-center text-center flex-1' : 'flex-row items-start gap-6'} ${!isLast ? (isHorizontal ? 'pb-0' : 'pb-12') : ''}`}
              >
                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={`absolute ${isHorizontal
                      ? 'top-8 left-[calc(50%+28px)] right-[calc(-50%+28px)] h-0.5 hidden md:block'
                      : 'left-8 top-16 bottom-0 w-0.5'
                    }`}
                    style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.2)' }}
                  />
                )}

                {/* Step number circle */}
                <div
                  className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)' }}
                >
                  <Icon size={28} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
                </div>

                {/* Step number badge */}
                <div
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white z-20"
                  style={{
                    backgroundColor: 'hsl(var(--tenant-color-primary))',
                    ...(isHorizontal
                      ? { top: '-4px', right: 'calc(50% - 36px)' }
                      : { top: '-4px', left: '48px' }
                    ),
                  }}
                >
                  {index + 1}
                </div>

                <div className={isHorizontal ? 'mt-4 px-4' : ''}>
                  <h3
                    className="text-lg font-bold mb-1"
                    style={{ color: 'hsl(var(--tenant-color-heading))' }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed max-w-[200px]"
                    style={{ color: 'hsl(var(--tenant-color-text))' }}
                  >
                    {step.description}
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
