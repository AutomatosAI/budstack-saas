'use client';

import React from 'react';
import Image from 'next/image';
import { Leaf, MapPin, Mail } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';
import { SocialIcons } from './social-icons';

interface FooterSection {
  title: string;
  links: { label: string; href: string }[];
}

/**
 * FooterBrand — Premium branded footer with contact info and icon headers.
 *
 * Features: Brand column with address + email, Leaf icon section headers,
 * configurable link columns, dark background, copyright bar.
 *
 * Config (via sectionConfig or defaults.json footer):
 *   tagline:    string
 *   address:    string (business address)
 *   email:      string (contact email)
 *   sections:   [{ title, links: [{ label, href }] }]
 *   disclaimer: string
 */
export function FooterBrand(props: SectionProps) {
  const { tenant, logoUrl, footer, sectionConfig, productsUrl, aboutUrl, contactUrl, consultationUrl } = props;

  const basePath = getTenantBasePath(tenant.subdomain);

  const defaultSections: FooterSection[] = [
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: aboutUrl || `${basePath}/about` },
        { label: 'Our Products', href: productsUrl || `${basePath}/products` },
        { label: 'The Wire', href: `${basePath}/the-wire` },
        { label: 'Contact', href: contactUrl || `${basePath}/contact` },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Patient Access', href: consultationUrl || `${basePath}/consultation` },
        { label: 'Conditions Treated', href: `${basePath}/conditions` },
        { label: 'FAQ', href: `${basePath}/faq` },
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
  const tagline = sectionConfig?.tagline || footer?.tagline || 'Pioneering tomorrow\'s medical cannabis solutions';
  const address = sectionConfig?.address || footer?.address || tenant.businessAddress || '';
  const email = sectionConfig?.email || footer?.email || tenant.contactEmail || '';
  const rawSections: FooterSection[] = sectionConfig?.sections || footer?.sections || defaultSections;
  const sections = rawSections.map((s) => ({
    ...s,
    links: s.links.map((l) => ({ ...l, href: prefixHref(l.href) })),
  }));
  const disclaimer = sectionConfig?.disclaimer || footer?.disclaimer || '';
  const socialLinks = sectionConfig?.socialLinks || footer?.socialLinks || [];

  const showFooterLogo = props.pageContent?.logoPlacement?.footerShowLogo ?? true;
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
        <div className="grid md:grid-cols-2 lg:grid-cols-12 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3 mb-4">
              {showFooterLogo && logoUrl && (
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
            <p className="opacity-70 text-sm leading-relaxed max-w-sm mb-6">{tagline}</p>

            {/* Contact Info */}
            {address && (
              <div className="flex items-start gap-2.5 mb-3 group">
                <MapPin size={16} className="opacity-40 group-hover:opacity-70 transition-colors mt-0.5 shrink-0" />
                <span className="text-sm opacity-60">{address}</span>
              </div>
            )}
            {email && (
              <div className="flex items-center gap-2.5 group">
                <Mail size={16} className="opacity-40 group-hover:opacity-70 transition-colors shrink-0" />
                <a href={`mailto:${email}`} className="text-sm opacity-60 hover:opacity-100 transition-colors">
                  {email}
                </a>
              </div>
            )}

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
          <div className="lg:col-span-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h4 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider opacity-90 mb-4">
                  <Leaf size={14} style={{ color: 'hsl(var(--tenant-color-accent, 164 48% 53%))' }} />
                  {section.title}
                </h4>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="text-sm opacity-60 hover:opacity-100 hover:translate-x-1 transform transition-all duration-200 inline-block"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
