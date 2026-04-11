'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';
import { NavAuthButton } from './NavAuthButton';

export function NavTransparent(props: SectionProps) {
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
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // When nav color overrides exist, use CSS vars even in unscrolled state.
  // Otherwise, fall back to white (readable on dark hero backgrounds).
  const hasOverrides = sectionConfig?.colorOverrides && Object.keys(sectionConfig.colorOverrides).length > 0;

  const textColor = scrolled || hasOverrides
    ? 'hsl(var(--tenant-color-text))'
    : 'white';
  const headingColor = scrolled || hasOverrides
    ? 'hsl(var(--tenant-color-heading))'
    : 'white';
  const ctaBgColor = 'hsl(var(--tenant-color-accent, var(--tenant-color-primary)))';
  const ctaStyle = scrolled || hasOverrides
    ? { backgroundColor: ctaBgColor, color: 'white' }
    : { backgroundColor: 'white', color: ctaBgColor };

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
        {/* LEFT ZONE */}
        <div className="hidden md:flex items-center gap-3 flex-1 min-w-0">
          {navPos === 'left' && (
            <a href={basePath || '/'} className="flex items-center gap-3">
              {logoUrl && (
                <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              {showName && (
                <span
                  className="text-xl font-bold transition-colors duration-300"
                  style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: headingColor }}
                >
                  {businessName}
                </span>
              )}
            </a>
          )}
          {(navPos === 'center' || navPos === 'right') && (
            <div className="flex items-center gap-8">
              {links.map((link: { label: string; href: string }) => (
                <a key={link.href} href={link.href} className="text-sm font-medium transition-colors duration-300" style={{ color: textColor }}>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* CENTER ZONE */}
        <div className="hidden md:flex items-center justify-center shrink-0">
          {navPos === 'center' && (
            <a href={basePath || '/'} className="flex items-center gap-3">
              {logoUrl && (
                <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              {showName && (
                <span
                  className="text-xl font-bold transition-colors duration-300"
                  style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: headingColor }}
                >
                  {businessName}
                </span>
              )}
            </a>
          )}
          {navPos === 'left' && (
            <div className="flex items-center gap-8">
              {links.map((link: { label: string; href: string }) => (
                <a key={link.href} href={link.href} className="text-sm font-medium transition-colors duration-300" style={{ color: textColor }}>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT ZONE */}
        <div className="hidden md:flex items-center gap-4 flex-1 justify-end">
          {navPos === 'right' && (
            <a href={basePath || '/'} className="flex items-center gap-3 mr-3">
              {logoUrl && (
                <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              {showName && (
                <span
                  className="text-xl font-bold transition-colors duration-300"
                  style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: headingColor }}
                >
                  {businessName}
                </span>
              )}
            </a>
          )}
          <a
            href={ctaHref}
            className="px-6 py-2 text-sm font-semibold rounded-full transition-all"
            style={ctaStyle}
          >
            {ctaLabel}
          </a>
          <NavAuthButton
            basePath={basePath}
            variant={scrolled ? 'light' : 'dark'}
            loginStyle={loginStyle}
            signedOutLabel={signedOutLabel}
          />
        </div>

        {/* Mobile: logo left + hamburger right */}
        <a href={basePath || '/'} className="md:hidden flex items-center gap-3">
          {logoUrl && (
            <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
              <Image src={logoUrl} alt={businessName} fill className="object-contain" />
            </div>
          )}
          {showName && (
            <span
              className="text-xl font-bold transition-colors duration-300"
              style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: headingColor }}
            >
              {businessName}
            </span>
          )}
        </a>
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          style={{
            // Drop shadow keeps the icon readable over bright hero frames
            // (e.g. sky in a video) while the nav is still transparent.
            filter: scrolled || hasOverrides ? 'none' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
          }}
        >
          {mobileOpen ? (
            <X size={24} style={{ color: textColor }} />
          ) : (
            <Menu size={24} style={{ color: textColor }} />
          )}
        </button>
      </div>

      {/* Mobile Menu — always renders on a SOLID panel so it never clashes
          with the transparent nav's hero background. Fallbacks to opaque
          white / dark text so it stays readable even when the tenant hasn't
          set --tenant-color-background / --tenant-color-text. */}
      {mobileOpen && (
        <div
          className="md:hidden mt-2 mx-4 rounded-xl border shadow-2xl px-6 py-4 space-y-3"
          style={{
            backgroundColor: 'hsl(var(--tenant-color-background, 0 0% 100%))',
            borderColor: 'hsl(var(--tenant-color-border, 0 0% 88%))',
          }}
        >
          {links.map((link: { label: string; href: string }) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-base font-medium py-2"
              style={{ color: 'hsl(var(--tenant-color-text, 220 15% 15%))' }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            className="block text-center px-6 py-3 text-sm font-semibold text-white rounded-full mt-3"
            style={{ backgroundColor: ctaBgColor }}
            onClick={() => setMobileOpen(false)}
          >
            {ctaLabel}
          </a>
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
