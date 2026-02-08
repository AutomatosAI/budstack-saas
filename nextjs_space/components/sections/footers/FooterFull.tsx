'use client';

import React from 'react';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';

interface FooterSection {
  title: string;
  links: { label: string; href: string }[];
}

export function FooterFull(props: SectionProps) {
  const { tenant, logoUrl, footer, sectionConfig, productsUrl, aboutUrl, contactUrl, consultationUrl } = props;

  const basePath = `/store/${tenant.subdomain}`;

  const defaultSections: FooterSection[] = [
    {
      title: 'Quick Links',
      links: [
        { label: 'Products', href: productsUrl || `${basePath}/products` },
        { label: 'About Us', href: aboutUrl || `${basePath}/about` },
        { label: 'Blog', href: `${basePath}/the-wire` },
        { label: 'Contact', href: contactUrl || `${basePath}/contact` },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'FAQ', href: `${basePath}/faq` },
        { label: 'Consultation', href: consultationUrl || `${basePath}/consultation` },
        { label: 'Conditions', href: `${basePath}/conditions` },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: `${basePath}/privacy` },
        { label: 'Terms of Service', href: `${basePath}/terms` },
        { label: 'Regulatory', href: `${basePath}/regulatory` },
      ],
    },
  ];

  const prefixHref = (href: string) =>
    href.startsWith('/') && !href.startsWith('/store/') ? `${basePath}${href}` : href;

  const businessName = tenant.businessName;
  const tagline = sectionConfig?.tagline || footer?.tagline || 'Premium medical cannabis, delivered with care.';
  const rawSections: FooterSection[] = sectionConfig?.sections || footer?.sections || defaultSections;
  const sections = rawSections.map((s) => ({
    ...s,
    links: s.links.map((l) => ({ ...l, href: prefixHref(l.href) })),
  }));
  const disclaimer = sectionConfig?.disclaimer || footer?.disclaimer || 'Medical cannabis should only be used under the guidance of a licensed healthcare professional.';

  const year = new Date().getFullYear();

  return (
    <footer
      className="pt-16 pb-8"
      style={{
        backgroundColor: 'hsl(var(--tenant-color-surface, var(--tenant-color-background, 220 15% 10%)))',
        color: 'hsl(var(--tenant-color-heading, 0 0% 100%))',
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
                className="text-xl font-bold"
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
          <p className="text-sm text-white/50" suppressHydrationWarning>
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
