'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';

export function NavTransparent(props: SectionProps) {
  const { tenant, logoUrl, consultationUrl, productsUrl, aboutUrl, contactUrl, navigation, sectionConfig } = props;

  const businessName = tenant.businessName;
  const basePath = getTenantBasePath(tenant.subdomain);

  const defaultLinks = [
    { label: 'Products', href: productsUrl || `${basePath}/products` },
    { label: 'About', href: aboutUrl || `${basePath}/about` },
    { label: 'Contact', href: contactUrl || `${basePath}/contact` },
  ];

  const prefixHref = (href: string) => prefixTenantHref(href, basePath);
  const rawLinks = sectionConfig?.links || navigation?.links || defaultLinks;
  const links = rawLinks.map((l: any) => ({ ...l, href: prefixHref(l.href) }));
  const ctaLabel = sectionConfig?.ctaLabel || navigation?.cta?.label || navigation?.ctaLabel || 'Book Consultation';
  const ctaHref = prefixHref(sectionConfig?.ctaHref || navigation?.cta?.href || consultationUrl || `${basePath}/consultation`);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 py-4 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'hsl(var(--tenant-color-background) / 0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid hsl(var(--tenant-color-border) / 0.3)' : 'none',
      }}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <a href={basePath || '/'} className="flex items-center gap-3">
          {logoUrl && (
            <div className="relative w-10 h-10">
              <Image src={logoUrl} alt={businessName} fill className="object-contain" />
            </div>
          )}
          <span
            className="text-xl font-bold transition-colors duration-300"
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              color: scrolled ? 'hsl(var(--tenant-color-heading))' : 'white',
            }}
          >
            {businessName}
          </span>
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link: { label: string; href: string }) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium transition-colors duration-300"
              style={{
                color: scrolled ? 'hsl(var(--tenant-color-text))' : 'white',
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            className="px-6 py-2 text-sm font-semibold rounded-full transition-all"
            style={{
              backgroundColor: scrolled ? 'hsl(var(--tenant-color-primary))' : 'white',
              color: scrolled ? 'white' : 'hsl(var(--tenant-color-primary))',
            }}
          >
            {ctaLabel}
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X size={24} style={{ color: scrolled ? 'hsl(var(--tenant-color-text))' : 'white' }} />
          ) : (
            <Menu size={24} style={{ color: scrolled ? 'hsl(var(--tenant-color-text))' : 'white' }} />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          className="md:hidden px-6 py-4 space-y-3 mt-2"
          style={{ backgroundColor: 'hsl(var(--tenant-color-background) / 0.98)' }}
        >
          {links.map((link: { label: string; href: string }) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-base font-medium py-2"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            className="block text-center px-6 py-3 text-sm font-semibold text-white rounded-full mt-3"
            style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
            onClick={() => setMobileOpen(false)}
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </nav>
  );
}
