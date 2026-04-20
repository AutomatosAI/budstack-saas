'use client';

import React from 'react';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';
import { SocialIcons } from './social-icons';

interface FooterSection {
  title: string;
  links: { label: string; href: string }[];
}

export function FooterFull(props: SectionProps) {
  const { tenant, logoUrl, footer, sectionConfig, productsUrl, aboutUrl, contactUrl, consultationUrl } = props;

  const basePath = getTenantBasePath(tenant.subdomain);

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

  const prefixHref = (href: string) => prefixTenantHref(href, basePath);

  const businessName = tenant.businessName;
  const tagline = sectionConfig?.tagline || footer?.tagline || 'Premium medical cannabis, delivered with care.';
  const rawSections: FooterSection[] = sectionConfig?.sections || footer?.sections || defaultSections;
  const sections = rawSections.map((s) => ({
    ...s,
    links: s.links.map((l) => ({ ...l, href: prefixHref(l.href) })),
  }));
  const disclaimer = sectionConfig?.disclaimer || footer?.disclaimer || 'Medical cannabis should only be used under the guidance of a licensed healthcare professional.';
  const socialLinks = sectionConfig?.socialLinks || footer?.socialLinks || [];

  const year = new Date().getFullYear();

  return (
    <footer
      className="pt-16 pb-8"
      style={{
        backgroundColor: 'hsl(var(--tenant-color-background))',
        color: 'hsl(var(--tenant-color-text))',
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
            <p className="opacity-70 text-sm leading-relaxed max-w-sm">{tagline}</p>
            <SocialIcons links={socialLinks} className="mt-4" />

            {/* Official Partner — Dr Green */}
            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-3">
                Official Partner
              </p>
              <div className="flex flex-col items-start gap-2">
                <Image
                  src="/drgreen-skull.png"
                  alt="Dr Green"
                  width={96}
                  height={96}
                  className="h-20 w-auto"
                />
                <Image
                  src="/drgreen-logo.png"
                  alt="Dr Green"
                  width={200}
                  height={64}
                  className="h-14 w-auto"
                />
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="font-bold text-sm uppercase tracking-wider mb-4 opacity-90">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm opacity-60 hover:opacity-100 transition-colors"
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
          <p className="text-xs opacity-40 mb-8 max-w-3xl">{disclaimer}</p>
        )}

        {/* Bottom Bar */}
        <div
          className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid hsl(var(--tenant-color-border, var(--tenant-color-text)) / 0.15)' }}
        >
          <p className="text-sm opacity-50" suppressHydrationWarning>
            &copy; {year} {businessName}. All rights reserved.
          </p>
          <p className="text-xs opacity-40">Powered by BudStacks</p>
        </div>
      </div>
    </footer>
  );
}
