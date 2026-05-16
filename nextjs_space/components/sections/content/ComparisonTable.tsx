'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Check, X } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { headerAlignClasses } from '@/lib/section-align';

interface FeatureRow {
  name: string;
  values: (boolean | string)[];
}

const defaultTiers = ['Basic', 'Pro', 'Enterprise'];

const defaultFeatures: FeatureRow[] = [
  { name: 'Product Access', values: ['10 Products', '50 Products', 'Unlimited'] },
  { name: 'Support', values: ['Email', 'Priority', '24/7 Dedicated'] },
  { name: 'Delivery', values: [true, true, true] },
  { name: 'Lab Reports', values: [false, true, true] },
  { name: 'Personal Consultant', values: [false, false, true] },
  { name: 'Custom Formulations', values: [false, false, true] },
  { name: 'API Access', values: [false, false, true] },
];

export function ComparisonTable(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Compare Plans';
  const subtitle = sectionConfig?.subtitle || 'Find the right fit for your needs';
  const tiers: string[] = sectionConfig?.tiers || defaultTiers;
  const features: FeatureRow[] = sectionConfig?.features || defaultFeatures;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  function renderValue(value: boolean | string) {
    if (value === true) {
      return (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)' }}
        >
          <Check size={14} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
        </div>
      );
    }
    if (value === false) {
      return (
        <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto bg-gray-100">
          <X size={14} className="text-gray-400" />
        </div>
      );
    }
    return (
      <span className="text-sm font-medium" style={{ color: 'hsl(var(--tenant-color-heading))' }}>
        {value}
      </span>
    );
  }

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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-5xl mx-auto overflow-x-auto"
        >
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th
                  className="text-left py-4 px-4 font-medium text-sm"
                  style={{ color: 'hsl(var(--tenant-color-text))' }}
                >
                  Feature
                </th>
                {tiers.map((tier, i) => (
                  <th
                    key={i}
                    className="text-center py-4 px-4 font-bold"
                    style={{ color: 'hsl(var(--tenant-color-heading))' }}
                  >
                    {tier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature, fi) => (
                <tr
                  key={fi}
                  className="transition-colors"
                  style={{
                    borderBottom: '1px solid hsl(var(--tenant-color-border))',
                  }}
                >
                  <td
                    className="py-4 px-4 text-sm"
                    style={{ color: 'hsl(var(--tenant-color-text))' }}
                  >
                    {feature.name}
                  </td>
                  {feature.values.map((value, vi) => (
                    <td key={vi} className="py-4 px-4 text-center">
                      {renderValue(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
