'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';

interface Category {
  title: string;
  description: string;
  href?: string;
  imageUrl?: string;
}

const defaultCategories: Category[] = [
  { title: 'Flower', description: 'Premium dried cannabis flower, carefully cultivated.', href: '/products?category=flower' },
  { title: 'Oils & Tinctures', description: 'Precise dosing with high-quality cannabis extracts.', href: '/products?category=oils' },
  { title: 'Edibles', description: 'Delicious infused products for a discreet experience.', href: '/products?category=edibles' },
  { title: 'Topicals', description: 'Targeted relief with cannabis-infused creams and balms.', href: '/products?category=topicals' },
];

export function ProductShowcase(props: SectionProps) {
  const { productsUrl, sectionConfig, tenant } = props;
  const basePath = getTenantBasePath(tenant.subdomain);
  const prefixHref = (href: string) => prefixTenantHref(href, basePath);
  const heading = sectionConfig?.heading || 'Our Products';
  const subtitle = sectionConfig?.subtitle || 'Explore our carefully curated selection of premium cannabis products';
  const ctaText = sectionConfig?.ctaText || 'View All Products';
  const ctaHref = sectionConfig?.ctaHref || productsUrl;
  const showButton = sectionConfig?.showButton !== 'no';
  const rawCategories: Category[] = sectionConfig?.categories || defaultCategories;
  const categories = rawCategories.map((c) => ({ ...c, href: c.href ? prefixHref(c.href) : prefixHref('/products') }));

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-16 sm:py-20 lg:py-24"
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

        <div className={`grid gap-6 ${
          categories.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
          categories.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' :
          categories.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}>
          {categories.map((cat, index) => (
            <motion.a
              key={index}
              href={cat.href}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group rounded-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-surface))',
                border: '1px solid hsl(var(--tenant-color-border))',
              }}
            >
              {cat.imageUrl && (
                <div className="relative w-full h-48 sm:h-56">
                  <Image src={cat.imageUrl} alt={cat.title} fill className="object-contain p-4" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                </div>
              )}
              <div className="p-6">
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
              </div>
            </motion.a>
          ))}
        </div>

        {showButton && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center mt-12"
          >
            <a
              href={ctaHref}
              className="inline-flex items-center gap-2 px-8 py-3 text-base font-semibold rounded-full transition-all hover:gap-3"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-primary))',
                color: 'white',
              }}
            >
              {ctaText} <ArrowRight size={16} />
            </a>
          </motion.div>
        )}
      </div>
    </section>
  );
}
