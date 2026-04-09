'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X, ShoppingCart } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';
import { NavAuthButton } from './NavAuthButton';

export function NavFull(props: SectionProps) {
  const { tenant, logoUrl, consultationUrl, productsUrl, aboutUrl, contactUrl, navigation, sectionConfig } = props;

  const businessName = tenant.businessName;
  const basePath = getTenantBasePath(tenant.subdomain);

  // Logo placement
  const logoPlacement = props.pageContent?.logoPlacement;
  const navPos = logoPlacement?.navPosition || 'left';
  const navSize = logoPlacement?.navSize || 'medium';
  const showName = logoPlacement?.showBusinessName ?? true;
  const navSizeLegacy: Record<string, number> = { small: 36, medium: 52, large: 72 };
  const logoSizePx = `${typeof navSize === 'number' ? navSize : (navSizeLegacy[navSize] || 52)}px`;

  const defaultLinks = [
    { label: 'Products', href: productsUrl || `${basePath}/products` },
    { label: 'About', href: aboutUrl || `${basePath}/about` },
    { label: 'The Wire', href: `${basePath}/the-wire` },
    { label: 'FAQ', href: `${basePath}/faq` },
    { label: 'Contact', href: contactUrl || `${basePath}/contact` },
  ];

  const prefixHref = (href: string) => prefixTenantHref(href, basePath);

  const rawLinks = sectionConfig?.links || navigation?.links || defaultLinks;
  const links = rawLinks.map((l: any) => ({ ...l, href: prefixHref(l.href) }));
  const ctaLabel = sectionConfig?.ctaLabel || sectionConfig?.cta?.label || navigation?.cta?.label || navigation?.ctaLabel || 'Book Consultation';
  const ctaHref = prefixHref(sectionConfig?.ctaHref || sectionConfig?.cta?.href || navigation?.cta?.href || consultationUrl || `${basePath}/consultation`);
  const loginStyle = sectionConfig?.loginStyle || navigation?.loginStyle || 'button';
  const signedOutLabel = sectionConfig?.signedOutLabel || navigation?.signedOutLabel || 'Login';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className="sticky top-0 z-50 py-3 transition-all duration-300"
      style={{
        backgroundColor: scrolled
          ? 'hsl(var(--tenant-color-background) / 0.98)'
          : 'hsl(var(--tenant-color-background))',
        borderBottom: '1px solid hsl(var(--tenant-color-border))',
        boxShadow: scrolled ? '0 2px 10px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        {/* LEFT ZONE */}
        <div className="hidden lg:flex items-center gap-3 flex-1 min-w-0">
          {navPos === 'left' && (
            <a href={basePath || '/'} className="flex items-center gap-3">
              {logoUrl && (
                <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              {showName && (
                <span
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {businessName}
                </span>
              )}
            </a>
          )}
          {(navPos === 'center' || navPos === 'right') && (
            <div className="flex items-center gap-8">
              {links.map((link: { label: string; href: string }) => (
                <a key={link.href} href={link.href} className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* CENTER ZONE */}
        <div className="hidden lg:flex items-center justify-center shrink-0">
          {navPos === 'center' && (
            <a href={basePath || '/'} className="flex items-center gap-3">
              {logoUrl && (
                <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              {showName && (
                <span
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {businessName}
                </span>
              )}
            </a>
          )}
          {navPos === 'left' && (
            <div className="flex items-center gap-8">
              {links.map((link: { label: string; href: string }) => (
                <a key={link.href} href={link.href} className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT ZONE */}
        <div className="hidden lg:flex items-center gap-4 flex-1 justify-end">
          {navPos === 'right' && (
            <a href={basePath || '/'} className="flex items-center gap-3 mr-3">
              {logoUrl && (
                <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              {showName && (
                <span
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {businessName}
                </span>
              )}
            </a>
          )}
          <a href={`${basePath}/cart`} aria-label="Cart">
            <ShoppingCart size={20} style={{ color: 'hsl(var(--tenant-color-text))' }} />
          </a>
          <a
            href={ctaHref}
            className="px-6 py-2 text-sm font-semibold text-white rounded-full transition-all hover:opacity-90"
            style={{ backgroundColor: 'hsl(var(--tenant-color-accent, var(--tenant-color-primary)))' }}
          >
            {ctaLabel}
          </a>
          <NavAuthButton
            basePath={basePath}
            variant="light"
            loginStyle={loginStyle}
            signedOutLabel={signedOutLabel}
          />
        </div>

        {/* Mobile: logo left + hamburger right */}
        <a href={basePath || '/'} className="lg:hidden flex items-center gap-3">
          {logoUrl && (
            <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
              <Image src={logoUrl} alt={businessName} fill className="object-contain" />
            </div>
          )}
          {showName && (
            <span className="text-xl font-bold" style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: 'hsl(var(--tenant-color-heading))' }}>
              {businessName}
            </span>
          )}
        </a>
        <button
          className="lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X size={24} style={{ color: 'hsl(var(--tenant-color-text))' }} />
          ) : (
            <Menu size={24} style={{ color: 'hsl(var(--tenant-color-text))' }} />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          className="lg:hidden border-t px-6 py-4 space-y-3"
          style={{
            backgroundColor: 'hsl(var(--tenant-color-background))',
            borderColor: 'hsl(var(--tenant-color-border))',
          }}
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
          <div className="pt-3 flex items-center gap-4">
            <a
              href={ctaHref}
              className="flex-1 text-center px-6 py-3 text-sm font-semibold text-white rounded-full"
              style={{ backgroundColor: 'hsl(var(--tenant-color-accent, var(--tenant-color-primary)))' }}
              onClick={() => setMobileOpen(false)}
            >
              {ctaLabel}
            </a>
          </div>
          <div className="pt-2">
            <NavAuthButton
              basePath={basePath}
              variant="light"
              loginStyle="button"
              signedOutLabel={signedOutLabel}
            />
          </div>
        </div>
      )}
    </nav>
  );
}
