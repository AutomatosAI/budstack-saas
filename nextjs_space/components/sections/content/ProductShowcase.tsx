'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

interface Category {
  title: string;
  description: string;
  href: string;
}

const defaultCategories: Category[] = [
  { title: 'Flower', description: 'Premium dried cannabis flower, carefully cultivated.', href: '/products?category=flower' },
  { title: 'Oils & Tinctures', description: 'Precise dosing with high-quality cannabis extracts.', href: '/products?category=oils' },
  { title: 'Edibles', description: 'Delicious infused products for a discreet experience.', href: '/products?category=edibles' },
  { title: 'Topicals', description: 'Targeted relief with cannabis-infused creams and balms.', href: '/products?category=topicals' },
];

export function ProductShowcase(props: SectionProps) {
  const { productsUrl, sectionConfig, tenant } = props;
  const basePath = `/store/${tenant.subdomain}`;
  const prefixHref = (href: string) =>
    href.startsWith('/') && !href.startsWith('/store/') ? `${basePath}${href}` : href;
  const heading = sectionConfig?.heading || 'Our Products';
  const subtitle = sectionConfig?.subtitle || 'Explore our carefully curated selection of premium cannabis products';
  const rawCategories: Category[] = sectionConfig?.categories || defaultCategories;
  const categories = rawCategories.map((c) => ({ ...c, href: prefixHref(c.href) }));

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-8 sm:py-10"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-8"
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
          <p className="text-lg" style={{ color: 'hsl(var(--tenant-color-text))' }}>
            {subtitle}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, index) => (
            <motion.a
              key={index}
              href={cat.href}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group p-8 rounded-2xl transition-all duration-300 hover:-translate-y-1"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-surface))',
                border: '1px solid hsl(var(--tenant-color-border))',
              }}
            >
              <h3
                className="text-xl font-bold mb-3"
                style={{ color: 'hsl(var(--tenant-color-heading))' }}
              >
                {cat.title}
              </h3>
              <p className="mb-4" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                {cat.description}
              </p>
              <span
                className="inline-flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all"
                style={{ color: 'hsl(var(--tenant-color-primary))' }}
              >
                Browse <ArrowRight size={14} />
              </span>
            </motion.a>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-12"
        >
          <a
            href={productsUrl}
            className="inline-flex items-center gap-2 px-8 py-3 text-base font-semibold rounded-full transition-all hover:gap-3"
            style={{
              backgroundColor: 'hsl(var(--tenant-color-primary))',
              color: 'white',
            }}
          >
            View All Products <ArrowRight size={16} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
