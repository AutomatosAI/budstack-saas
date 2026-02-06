'use client';

import React from 'react';
import Image from 'next/image';

interface FooterSection {
  title: string;
  links: { label: string; href: string }[];
}

interface FooterProps {
  businessName: string;
  logoUrl?: string | null;
  tagline?: string;
  sections?: FooterSection[];
  disclaimer?: string;
}

const defaultSections: FooterSection[] = [
  {
    title: 'Shop',
    links: [
      { label: 'All Products', href: '/products' },
      { label: 'Popular Picks', href: '/products?filter=popular' },
      { label: 'New Drops', href: '/products?filter=new' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'The Wire', href: '/the-wire' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Compliance', href: '/regulatory' },
    ],
  },
];

export default function Footer({
  businessName,
  logoUrl,
  tagline = 'Your vibe. Your bud. Delivered with care.',
  sections = defaultSections,
  disclaimer = 'Cannabis should only be used under the guidance of a licensed healthcare professional. Must be of legal age.',
}: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="pt-16 pb-8"
      style={{
        backgroundColor: 'hsl(var(--tenant-color-heading))',
        color: 'white',
      }}
    >
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              {logoUrl && (
                <div className="relative w-10 h-10">
                  <Image src={logoUrl} alt={businessName} fill className="object-contain" />
                </div>
              )}
              <span
                className="text-xl font-extrabold"
                style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
              >
                {businessName}
              </span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed max-w-sm">{tagline}</p>
          </div>

          {/* Link Columns */}
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="font-bold text-sm uppercase tracking-wider mb-4 text-white/90">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        {disclaimer && (
          <p className="text-xs text-white/40 mb-8 max-w-3xl">{disclaimer}</p>
        )}

        {/* Bottom Bar */}
        <div
          className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-sm text-white/50">
            &copy; {year} {businessName}. All rights reserved.
          </p>
          <p className="text-xs text-white/30">
            Powered by BudStack
          </p>
        </div>
      </div>
    </footer>
  );
}
