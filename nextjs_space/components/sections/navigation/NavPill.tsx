'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X, ShoppingCart } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant/tenant-utils';
import { NavAuthButton } from './NavAuthButton';

/**
 * NavPill — Compact centered floating capsule navigation.
 *
 * Modern SaaS style (Linear/Vercel). Pill sits centered at top with
 * generous margin, not edge-to-edge. Logo left, links center, auth right.
 * Tightens on scroll.
 *
 * Config (via sectionConfig or defaults.json navigation):
 *   links:          [{ label, href }]
 *   cta:            { label, href }        — optional CTA
 *   showCart:        boolean (default true)
 *   loginStyle:      'button' | 'icon'     — auth button style
 *   signedOutLabel:  string (default 'Login')
 */
export function NavPill(props: SectionProps) {
  const { tenant, logoUrl, consultationUrl, productsUrl, aboutUrl, contactUrl, navigation, sectionConfig } = props;

  const businessName = tenant.businessName;
  const basePath = getTenantBasePath(tenant.subdomain);

  // Logo placement
  const logoPlacement = props.pageContent?.logoPlacement;
  const navSize = logoPlacement?.navSize || 'medium';
  const showName = logoPlacement?.showBusinessName ?? true;
  const navSizeLegacy: Record<string, number> = { small: 28, medium: 38, large: 52 };
  const logoSizePx = `${typeof navSize === 'number' ? navSize : (navSizeLegacy[navSize] || 38)}px`;

  const defaultLinks = [
    { label: 'Products', href: productsUrl || `${basePath}/products` },
    { label: 'About', href: aboutUrl || `${basePath}/about` },
    { label: 'Contact', href: contactUrl || `${basePath}/contact` },
  ];

  const prefixHref = (href: string) => prefixTenantHref(href, basePath);
  const rawLinks = sectionConfig?.links || navigation?.links || defaultLinks;
  const links = rawLinks.map((l: any) => ({ ...l, href: prefixHref(l.href) }));

  const cta = sectionConfig?.cta || navigation?.cta;
  const ctaLabel = sectionConfig?.ctaLabel || cta?.label;
  const ctaHref = ctaLabel ? prefixHref(sectionConfig?.ctaHref || cta?.href || consultationUrl || `${basePath}/consultation`) : undefined;

  const showCart = sectionConfig?.showCart !== false && navigation?.showCart !== false;
  const loginStyle = sectionConfig?.loginStyle || navigation?.loginStyle || 'icon';
  const signedOutLabel = sectionConfig?.signedOutLabel || navigation?.signedOutLabel || 'Login';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-300"
      style={{ padding: scrolled ? '8px 16px 0' : '16px 24px 0' }}
    >
      <div
        className="transition-all duration-300 w-full"
        style={{
          maxWidth: scrolled ? '860px' : '780px',
          backgroundColor: 'hsl(var(--tenant-color-background) / 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: scrolled ? '16px' : '24px',
          border: '1px solid hsl(var(--tenant-color-border) / 0.4)',
          boxShadow: scrolled
            ? '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)'
            : '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="px-5 flex items-center justify-between transition-all duration-300"
          style={{ height: scrolled ? '52px' : '58px' }}
        >
          {/* Logo — always left */}
          <a href={basePath || '/'} className="flex items-center gap-2.5 shrink-0">
            {logoUrl && (
              <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                <Image src={logoUrl} alt={businessName} fill className="object-contain" />
              </div>
            )}
            {showName && (
              <span
                className="font-semibold text-sm hidden sm:inline"
                style={{
                  fontFamily: 'var(--tenant-font-heading, sans-serif)',
                  color: 'hsl(var(--tenant-color-heading))',
                }}
              >
                {businessName}
              </span>
            )}
          </a>

          {/* Center Links — desktop */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map((link: { label: string; href: string }) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                style={{
                  color: 'hsl(var(--tenant-color-text) / 0.7)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--tenant-color-border) / 0.5)';
                  e.currentTarget.style.color = 'hsl(var(--tenant-color-text))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'hsl(var(--tenant-color-text) / 0.7)';
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Zone — desktop */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {showCart && (
              <a
                href={`${basePath}/cart`}
                className="p-1.5 rounded-full transition-colors"
                aria-label="Cart"
                style={{ color: 'hsl(var(--tenant-color-text) / 0.6)' }}
              >
                <ShoppingCart size={16} />
              </a>
            )}

            {ctaLabel && ctaHref && (
              <a
                href={ctaHref}
                className="px-4 py-1.5 text-xs font-semibold rounded-full text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
              >
                {ctaLabel}
              </a>
            )}

            <NavAuthButton
              basePath={basePath}
              variant="light"
              loginStyle={loginStyle}
              signedOutLabel={signedOutLabel}
            />
          </div>

          {/* Mobile: cart + hamburger */}
          <div className="flex md:hidden items-center gap-1">
            {showCart && (
              <a
                href={`${basePath}/cart`}
                className="p-2 rounded-full"
                aria-label="Cart"
                style={{ color: 'hsl(var(--tenant-color-text) / 0.6)' }}
              >
                <ShoppingCart size={18} />
              </a>
            )}
            <button
              className="p-2 rounded-full transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div
            className="md:hidden px-5 pb-4 pt-2 space-y-1 border-t"
            style={{ borderColor: 'hsl(var(--tenant-color-border) / 0.3)' }}
          >
            {links.map((link: { label: string; href: string }) => (
              <a
                key={link.href}
                href={link.href}
                className="block text-sm font-medium py-2.5 px-3 rounded-lg transition-colors"
                style={{ color: 'hsl(var(--tenant-color-text))' }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            {ctaLabel && ctaHref && (
              <a
                href={ctaHref}
                className="block text-center px-5 py-2.5 text-sm font-semibold text-white rounded-full mt-2"
                style={{ backgroundColor: 'hsl(var(--tenant-color-primary))' }}
                onClick={() => setMobileOpen(false)}
              >
                {ctaLabel}
              </a>
            )}
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
      </div>
    </nav>
  );
}
