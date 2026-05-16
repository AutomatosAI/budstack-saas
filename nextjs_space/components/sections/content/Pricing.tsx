'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Check } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { headerAlignClasses } from '@/lib/section-align';

interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

const defaultTiers: PricingTier[] = [
  {
    name: 'Starter',
    price: 'R199/mo',
    description: 'Perfect for getting started',
    features: ['5 Products', 'Basic Support', 'Monthly Delivery', 'Email Updates'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: 'R499/mo',
    description: 'Most popular choice',
    features: ['20 Products', 'Priority Support', 'Weekly Delivery', 'Personal Consultant', 'Lab Reports'],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'R999/mo',
    description: 'For businesses & clinics',
    features: ['Unlimited Products', '24/7 Support', 'Daily Delivery', 'Dedicated Account Manager', 'Custom Formulations', 'API Access'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export function Pricing(props: SectionProps) {
  const { sectionConfig, consultationUrl } = props;
  const heading = sectionConfig?.heading || 'Simple, Transparent Pricing';
  const subtitle = sectionConfig?.subtitle || 'Choose the plan that works for you';
  const backgroundImageUrl = sectionConfig?.backgroundImageUrl || null;
  const overlayOpacity = parseFloat(sectionConfig?.overlayOpacity ?? '0.5');
  const tiers: PricingTier[] = sectionConfig?.tiers || defaultTiers;

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
          className={`${headerAlignClasses(sectionConfig?.textAlign)} max-w-3xl mb-12`}
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

        <div className={`grid grid-cols-1 ${tiers.length === 2 ? 'md:grid-cols-2 max-w-4xl' : 'md:grid-cols-3 max-w-6xl'} gap-6 mx-auto items-stretch`}>
          {tiers.map((tier, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative rounded-2xl p-8 flex flex-col ${tier.highlighted ? 'scale-[1.02] shadow-2xl' : 'shadow-sm'}`}
              style={{
                backgroundColor: tier.highlighted
                  ? 'hsl(var(--tenant-color-primary))'
                  : 'hsl(var(--tenant-color-background))',
                border: tier.highlighted
                  ? 'none'
                  : '1px solid hsl(var(--tenant-color-border))',
              }}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white"
                  style={{ color: 'hsl(var(--tenant-color-primary))' }}
                >
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ color: tier.highlighted ? 'white' : 'hsl(var(--tenant-color-heading))' }}
                >
                  {tier.name}
                </h3>
                <p
                  className="text-sm mb-4"
                  style={{ color: tier.highlighted ? 'rgba(255,255,255,0.8)' : 'hsl(var(--tenant-color-text))' }}
                >
                  {tier.description}
                </p>
                <p
                  className="text-4xl font-bold"
                  style={{ color: tier.highlighted ? 'white' : 'hsl(var(--tenant-color-heading))' }}
                >
                  {tier.price}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature, fi) => (
                  <li key={fi} className="flex items-start gap-3">
                    <Check
                      size={18}
                      className="shrink-0 mt-0.5"
                      style={{ color: tier.highlighted ? 'rgba(255,255,255,0.9)' : 'hsl(var(--tenant-color-primary))' }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: tier.highlighted ? 'rgba(255,255,255,0.9)' : 'hsl(var(--tenant-color-text))' }}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={consultationUrl || '#'}
                className="block text-center px-6 py-3 rounded-full font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: tier.highlighted
                    ? 'white'
                    : 'hsl(var(--tenant-color-primary))',
                  color: tier.highlighted
                    ? 'hsl(var(--tenant-color-primary))'
                    : 'white',
                }}
              >
                {tier.cta}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
