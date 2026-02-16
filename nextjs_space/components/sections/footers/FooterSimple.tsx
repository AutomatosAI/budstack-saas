'use client';

import React from 'react';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';

export function FooterSimple(props: SectionProps) {
  const { tenant, footer, sectionConfig, contactUrl } = props;

  const businessName = tenant.businessName;
  const basePath = getTenantBasePath(tenant.subdomain);

  const defaultLinks = [
    { label: 'Privacy', href: `${basePath}/privacy` },
    { label: 'Terms', href: `${basePath}/terms` },
    { label: 'Contact', href: contactUrl || `${basePath}/contact` },
  ];

  const prefixHref = (href: string) => prefixTenantHref(href, basePath);
  const rawLinks = sectionConfig?.links || footer?.links || defaultLinks;
  const links = rawLinks.map((l: any) => ({ ...l, href: prefixHref(l.href) }));

  const year = new Date().getFullYear();

  return (
    <footer
      className="py-8"
      style={{
        backgroundColor: 'hsl(var(--tenant-color-background))',
        borderTop: '1px solid hsl(var(--tenant-color-border))',
      }}
    >
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm" style={{ color: 'hsl(var(--tenant-color-text))' }} suppressHydrationWarning>
          &copy; {year} {businessName}. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          {links.map((link: { label: string; href: string }) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
