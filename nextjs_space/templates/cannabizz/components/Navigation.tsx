'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X, ShoppingCart } from 'lucide-react';

interface NavLink {
  label: string;
  href: string;
}

interface NavigationProps {
  businessName: string;
  logoUrl?: string | null;
  links?: NavLink[];
  ctaLabel?: string;
  ctaHref?: string;
  tenant?: any;
}

const defaultLinks: NavLink[] = [
  { label: 'Products', href: '/products' },
  { label: 'About', href: '/about' },
  { label: 'The Wire', href: '/the-wire' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

export default function Navigation({
  businessName,
  logoUrl,
  links = defaultLinks,
  ctaLabel = 'Get Started',
  ctaHref = '/consultation',
}: NavigationProps) {
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
        borderBottom: `1px solid hsl(var(--tenant-color-border))`,
        boxShadow: scrolled ? '0 2px 20px hsl(var(--tenant-color-primary) / 0.1)' : 'none',
      }}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          {logoUrl && (
            <div className="relative w-10 h-10">
              <Image src={logoUrl} alt={businessName} fill className="object-contain" />
            </div>
          )}
          <span
            className="text-xl font-extrabold"
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              color: 'hsl(var(--tenant-color-heading))',
            }}
          >
            {businessName}
          </span>
        </a>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA + Cart */}
        <div className="hidden lg:flex items-center gap-4">
          <a href="/cart" aria-label="Cart">
            <ShoppingCart size={20} style={{ color: 'hsl(var(--tenant-color-text))' }} />
          </a>
          <a
            href={ctaHref}
            className="px-6 py-2 text-sm font-bold text-white rounded-full transition-all hover:scale-105"
            style={{
              backgroundColor: 'hsl(var(--tenant-color-primary))',
              boxShadow: '0 0 15px hsl(var(--tenant-color-primary) / 0.3)',
            }}
          >
            {ctaLabel}
          </a>
        </div>

        {/* Mobile Toggle */}
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
          {links.map((link) => (
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
              className="flex-1 text-center px-6 py-3 text-sm font-bold text-white rounded-full"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-primary))',
                boxShadow: '0 0 15px hsl(var(--tenant-color-primary) / 0.3)',
              }}
              onClick={() => setMobileOpen(false)}
            >
              {ctaLabel}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
