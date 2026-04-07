'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';

export function NavMinimal(props: SectionProps) {
  const { tenant, logoUrl, productsUrl, aboutUrl, contactUrl, navigation, sectionConfig } = props;

  const businessName = tenant.businessName;
  const basePath = getTenantBasePath(tenant.subdomain);

  // Logo placement
  const logoPlacement = props.pageContent?.logoPlacement;
  const navPos = logoPlacement?.navPosition || 'left';
  const navSize = logoPlacement?.navSize || 'medium';
  const showName = logoPlacement?.showBusinessName ?? true;
  const navSizeMap: Record<string, string> = { small: '32px', medium: '44px', large: '60px' };
  const logoSizePx = navSizeMap[navSize] || '44px';

  const defaultLinks = [
    { label: 'Products', href: productsUrl || `${basePath}/products` },
    { label: 'About', href: aboutUrl || `${basePath}/about` },
    { label: 'Contact', href: contactUrl || `${basePath}/contact` },
  ];

  const prefixHref = (href: string) => prefixTenantHref(href, basePath);
  const rawLinks = sectionConfig?.links || navigation?.links || defaultLinks;
  const links = rawLinks.map((l: any) => ({ ...l, href: prefixHref(l.href) }));

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 py-4 backdrop-blur-md"
      style={{
        backgroundColor: 'hsl(var(--tenant-color-background) / 0.95)',
        borderBottom: '1px solid hsl(var(--tenant-color-border))',
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
                <span className="text-lg font-bold" style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: 'hsl(var(--tenant-color-heading))' }}>
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
        <div className="hidden md:flex items-center justify-center shrink-0">
          {navPos === 'center' && (
            <a href={basePath || '/'} className="flex items-center gap-3">
              {logoUrl && (
                <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              {showName && (
                <span className="text-lg font-bold" style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: 'hsl(var(--tenant-color-heading))' }}>
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
        <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
          {navPos === 'right' && (
            <a href={basePath || '/'} className="flex items-center gap-3">
              {logoUrl && (
                <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              {showName && (
                <span className="text-lg font-bold" style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: 'hsl(var(--tenant-color-heading))' }}>
                  {businessName}
                </span>
              )}
            </a>
          )}
        </div>

        {/* Mobile: logo left + hamburger right */}
        <a href={basePath || '/'} className="md:hidden flex items-center gap-3">
          {logoUrl && (
            <div className="relative" style={{ width: logoSizePx, height: logoSizePx }}>
              <Image src={logoUrl} alt={businessName} fill className="object-contain" />
            </div>
          )}
          {showName && (
            <span className="text-lg font-bold" style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)', color: 'hsl(var(--tenant-color-heading))' }}>
              {businessName}
            </span>
          )}
        </a>
        <button
          className="md:hidden"
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
          className="md:hidden border-t px-6 py-4 space-y-3"
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
        </div>
      )}
    </nav>
  );
}
