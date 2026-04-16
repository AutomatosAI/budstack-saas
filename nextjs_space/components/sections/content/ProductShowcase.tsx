'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Loader2 } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';

interface Category {
  title: string;
  description: string;
  href?: string;
  imageUrl?: string;
}

interface FeaturedProduct {
  id: string;
  name: string;
  type?: string;
  imageUrl?: string;
  image_url?: string;
  retailPrice?: number;
  price?: number;
  isAvailable?: boolean;
  currency?: string;
  currencyCode?: string;
  priceUnit?: string;
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
  const backgroundImageUrl = sectionConfig?.backgroundImageUrl || null;
  const overlayOpacity = parseFloat(sectionConfig?.overlayOpacity ?? '0.5');
  const showButton = sectionConfig?.showButton !== 'no';
  const imageMode = sectionConfig?.imageMode || 'contain';
  const dataSource = sectionConfig?.dataSource || 'manual';
  const productIds: string = sectionConfig?.productIds || '';

  // Manual categories (fallback mode)
  const rawCategories: Category[] = sectionConfig?.categories || defaultCategories;
  const categories = rawCategories.map((c) => ({ ...c, href: c.href ? prefixHref(c.href) : prefixHref('/products') }));

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  // Real products mode
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (dataSource !== 'products' || !productIds) return;

    let cancelled = false;
    setLoadingProducts(true);

    fetch(`/api/store/${tenant.subdomain}/products/featured?ids=${encodeURIComponent(productIds)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setProducts(data.success ? (data.data || []) : []);
        }
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });

    return () => { cancelled = true; };
  }, [dataSource, productIds, tenant.subdomain]);

  const useRealProducts = dataSource === 'products' && productIds;

  // Grid column logic
  const itemCount = useRealProducts ? products.length : categories.length;
  const gridCols =
    itemCount === 1 ? 'grid-cols-1 max-w-md mx-auto' :
    itemCount === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' :
    itemCount === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <section
      ref={ref}
      className="relative py-16 sm:py-20 lg:py-24"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
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

        {/* Loading state for real products */}
        {useRealProducts && loadingProducts && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'hsl(var(--tenant-color-primary))' }} />
            <span style={{ color: 'hsl(var(--tenant-color-text))' }}>Loading products...</span>
          </div>
        )}

        {/* Empty state — products mode active but nothing loaded */}
        {useRealProducts && !loadingProducts && products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: 'hsl(var(--tenant-color-text) / 0.6)' }}>
              Products coming soon.
            </p>
          </div>
        )}

        {/* Real products grid */}
        {useRealProducts && !loadingProducts && products.length > 0 && (
          <div className={`grid gap-6 ${gridCols}`}>
            {products.map((product, index) => {
              const img = product.imageUrl || product.image_url;
              // Mirror /products page: prefer .price (per-gram) over .retailPrice
              const price = product.price ?? product.retailPrice ?? 0;
              // Use the symbol ("R") not the ISO code ("ZAR")
              const currency = product.currency || 'R';
              const productHref = prefixHref(`/products?id=${product.id}`);

              return (
                <motion.a
                  key={product.id}
                  href={productHref}
                  initial={{ opacity: 0, y: 30 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group rounded-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                  style={{
                    backgroundColor: 'hsl(var(--tenant-color-surface))',
                    border: '1px solid hsl(var(--tenant-color-border))',
                  }}
                >
                  {img && (
                    <div
                      className="relative w-full h-56 sm:h-64 md:h-72 overflow-hidden"
                      style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.04)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={product.name}
                        className={`w-full h-full ${imageMode === 'cover' ? 'object-cover' : 'object-contain p-4'}`}
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <h3
                      className="text-xl font-bold mb-2"
                      style={{ color: 'hsl(var(--tenant-color-heading))' }}
                    >
                      {product.name}
                    </h3>
                    {product.type && (
                      <p className="text-sm mb-2" style={{ color: 'hsl(var(--tenant-color-text) / 0.7)' }}>
                        {product.type}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-lg font-bold"
                        style={{ color: 'hsl(var(--tenant-color-primary))' }}
                      >
                        {price > 0
                          ? `${currency} ${price.toFixed(2)}`
                          : 'Price on request'}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all"
                        style={{ color: 'hsl(var(--tenant-color-primary))' }}
                      >
                        View <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>
        )}

        {/* Manual categories grid (original behavior) */}
        {!useRealProducts && (
          <div className={`grid gap-6 ${gridCols}`}>
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
                  <div
                    className="relative w-full h-56 sm:h-64 md:h-72 overflow-hidden"
                    style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.04)' }}
                  >
                    <Image
                      src={cat.imageUrl}
                      alt={cat.title}
                      fill
                      className={imageMode === 'cover' ? 'object-cover' : 'object-contain p-4'}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  </div>
                )}
                <div className="p-5">
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
        )}

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
