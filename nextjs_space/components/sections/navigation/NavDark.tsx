'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X, ShoppingCart } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';

/**
 * NavDark — Premium dark glassmorphic floating navigation bar.
 *
 * Floats above content with rounded corners, margin from edges,
 * and a dark sage-teal backdrop. Shrinks on scroll.
 *
 * Config (via sectionConfig or defaults.json navigation):
 *   links: [{ label, href }]
 *   cta:   { label, href }              — primary CTA (glass pill)
 *   cta2:  { label, href }              — secondary CTA (glass pill)
 *   showCart: boolean (default true)
 */
export function NavDark(props: SectionProps) {
  const { tenant, logoUrl, consultationUrl, productsUrl, aboutUrl, contactUrl, navigation, sectionConfig } = props;

  const businessName = tenant.businessName;
  const basePath = getTenantBasePath(tenant.subdomain);

  // Logo placement
  const logoPlacement = props.pageContent?.logoPlacement;
  const navPos = logoPlacement?.navPosition || 'left';
  const navSize = logoPlacement?.navSize || 'medium';
  const showName = logoPlacement?.showBusinessName ?? true;
  const navSizeLegacy: Record<string, number> = { small: 36, medium: 56, large: 76 };
  const resolvedNavPx = typeof navSize === 'number' ? navSize : (navSizeLegacy[navSize] || 56);
  const logoSizes = { normal: `${resolvedNavPx}px`, scrolled: `${Math.round(resolvedNavPx * 0.7)}px` };

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

  // Primary CTA
  const cta1Label = sectionConfig?.ctaLabel || navigation?.cta?.label || 'Check Eligibility';
  const cta1Href = prefixHref(
    sectionConfig?.ctaHref || navigation?.cta?.href || consultationUrl || `${basePath}/consultation`,
  );

  // Secondary CTA (optional)
  const cta2 = sectionConfig?.cta2 || navigation?.cta2;
  const cta2Label = cta2?.label;
  const cta2Href = cta2?.href ? prefixHref(cta2.href) : undefined;

  const showCart = sectionConfig?.showCart !== false && navigation?.showCart !== false;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ padding: scrolled ? '4px 6px 0' : '8px 8px 0' }}
    >
      <div
        className="mx-auto transition-all duration-300"
        style={{
          maxWidth: '1400px',
          backgroundColor: scrolled
            ? 'rgba(42, 61, 58, 0.98)'
            : 'rgba(42, 61, 58, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: scrolled ? '12px' : '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: scrolled
            ? '0 4px 24px rgba(0,0,0,0.2)'
            : '0 2px 12px rgba(0,0,0,0.1)',
        }}
      >
        <div
          className="px-6 flex items-center justify-between transition-all duration-300"
          style={{ height: scrolled ? '60px' : '72px' }}
        >
          {/* 3-Zone Nav Layout */}
          {/* LEFT ZONE */}
          <div className="hidden lg:flex items-center gap-3 flex-1 min-w-0">
            {navPos === 'left' && (
              <a href={basePath || '/'} className="flex items-center gap-3 shrink-0">
                {logoUrl && (
                  <div
                    className="relative transition-all duration-300"
                    style={{
                      width: scrolled ? logoSizes.scrolled : logoSizes.normal,
                      height: scrolled ? logoSizes.scrolled : logoSizes.normal,
                    }}
                  >
                    <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                  </div>
                )}
                {showName && (
                  <span
                    className="font-bold text-white transition-all duration-300 uppercase tracking-wide"
                    style={{
                      fontFamily: 'var(--tenant-font-heading, sans-serif)',
                      fontSize: scrolled ? '0.95rem' : '1.1rem',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {businessName}
                  </span>
                )}
              </a>
            )}
            {navPos === 'center' && (
              <div className="flex items-center gap-1">
                {links.map((link: { label: string; href: string }) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-xs font-medium text-white/80 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/10"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
            {navPos === 'right' && (
              <div className="flex items-center gap-1">
                {links.map((link: { label: string; href: string }) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-xs font-medium text-white/80 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/10"
                  >
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
                  <div
                    className="relative transition-all duration-300"
                    style={{
                      width: scrolled ? logoSizes.scrolled : logoSizes.normal,
                      height: scrolled ? logoSizes.scrolled : logoSizes.normal,
                    }}
                  >
                    <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                  </div>
                )}
                {showName && (
                  <span
                    className="font-bold text-white transition-all duration-300 uppercase tracking-wide"
                    style={{
                      fontFamily: 'var(--tenant-font-heading, sans-serif)',
                      fontSize: scrolled ? '0.95rem' : '1.1rem',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {businessName}
                  </span>
                )}
              </a>
            )}
            {navPos === 'left' && (
              <div className="flex items-center gap-1">
                {links.map((link: { label: string; href: string }) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-xs font-medium text-white/80 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/10"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT ZONE */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 flex-1 justify-end">
            {navPos === 'right' && (
              <a href={basePath || '/'} className="flex items-center gap-3 mr-3">
                {logoUrl && (
                  <div
                    className="relative transition-all duration-300"
                    style={{
                      width: scrolled ? logoSizes.scrolled : logoSizes.normal,
                      height: scrolled ? logoSizes.scrolled : logoSizes.normal,
                    }}
                  >
                    <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                  </div>
                )}
                {showName && (
                  <span
                    className="font-bold text-white transition-all duration-300 uppercase tracking-wide"
                    style={{
                      fontFamily: 'var(--tenant-font-heading, sans-serif)',
                      fontSize: scrolled ? '0.95rem' : '1.1rem',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {businessName}
                  </span>
                )}
              </a>
            )}

            {showCart && (
              <a
                href={`${basePath}/cart`}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Cart"
              >
                <ShoppingCart size={18} className="text-white/70" />
              </a>
            )}

            {/* Primary CTA — glass pill */}
            <a
              href={cta1Href}
              className="px-5 py-2 text-xs font-semibold rounded-full transition-all hover:scale-[1.03]"
              style={{
                color: 'white',
                border: '1.5px solid rgba(255,255,255,0.4)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))',
                backdropFilter: 'blur(12px)',
              }}
            >
              {cta1Label}
            </a>

            {/* Secondary CTA — glass pill */}
            {cta2Label && cta2Href && (
              <a
                href={cta2Href}
                className="px-5 py-2 text-xs font-semibold rounded-full transition-all hover:scale-[1.03]"
                style={{
                  color: 'white',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {cta2Label}
              </a>
            )}
          </div>

          {/* Mobile: always show logo left + hamburger right */}
          <a href={basePath || '/'} className="lg:hidden flex items-center gap-3 shrink-0">
            {logoUrl && (
              <div
                className="relative transition-all duration-300"
                style={{
                  width: scrolled ? logoSizes.scrolled : logoSizes.normal,
                  height: scrolled ? logoSizes.scrolled : logoSizes.normal,
                }}
              >
                <Image src={logoUrl} alt={businessName} fill className="object-contain" />
              </div>
            )}
            {showName && (
              <span
                className="font-bold text-white transition-all duration-300 uppercase tracking-wide text-sm"
                style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
              >
                {businessName}
              </span>
            )}
          </a>
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X size={24} className="text-white" />
            ) : (
              <Menu size={24} className="text-white" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div
            className="lg:hidden px-6 py-4 space-y-2 border-t"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            {links.map((link: { label: string; href: string }) => (
              <a
                key={link.href}
                href={link.href}
                className="block text-base font-medium text-white/85 py-3 px-3 rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 space-y-2">
              <a
                href={cta1Href}
                className="block text-center px-6 py-3 text-sm font-semibold text-white rounded-full transition-all"
                style={{
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                }}
                onClick={() => setMobileOpen(false)}
              >
                {cta1Label}
              </a>
              {cta2Label && cta2Href && (
                <a
                  href={cta2Href}
                  className="block text-center px-6 py-3 text-sm font-semibold text-white rounded-full transition-all"
                  style={{
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))',
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  {cta2Label}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
