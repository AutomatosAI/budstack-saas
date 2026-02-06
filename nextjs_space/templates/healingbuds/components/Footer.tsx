'use client';

import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Leaf } from "lucide-react";

interface FooterProps {
  businessName: string;
  logoUrl?: string | null;
  tenant: any;
}

export default function Footer({ businessName, logoUrl, tenant }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      id="contact"
      className="text-white relative overflow-hidden"
      style={{ backgroundColor: 'var(--tenant-color-primary, #1C4F4D)' }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Footer Content */}
        <div className="py-12 sm:py-16 border-b border-white/10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-16">

            {/* Brand Column */}
            <div className="lg:col-span-4">
              <Link href={`/store/${tenant.subdomain}`} className="inline-block mb-5 group">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={businessName}
                    width={120}
                    height={40}
                    className="h-10 w-auto object-contain group-hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <span className="text-2xl font-bold">{businessName}</span>
                )}
              </Link>
              <p
                className="text-white/70 text-sm leading-relaxed mb-6"
                style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
              >
                Pioneering tomorrow's medical cannabis solutions
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-white/60 text-sm group">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 group-hover:text-primary transition-colors" />
                  <span style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}>
                    {tenant.businessAddress || "Medical Cannabis Provider"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-white/60 text-sm group">
                  <Mail className="w-4 h-4 flex-shrink-0 group-hover:text-primary transition-colors" />
                  <a
                    href={`mailto:${tenant.contactEmail}`}
                    className="hover:text-white transition-colors"
                    style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                  >
                    {tenant.contactEmail || "info@example.com"}
                  </a>
                </div>
              </div>
            </div>

            {/* Navigation Columns */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-10">

              {/* Company */}
              <div>
                <h4
                  className="font-semibold text-sm uppercase tracking-wider mb-5 text-white/90 flex items-center gap-2"
                  style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                >
                  <Leaf className="w-3.5 h-3.5 text-primary" />
                  Company
                </h4>
                <ul className="space-y-3">
                  <li>
                    <Link
                      href={`/store/${tenant.subdomain}/about`}
                      className="text-sm text-white/60 hover:text-white transition-colors inline-block hover:translate-x-1 transform duration-200"
                      style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                    >
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/store/${tenant.subdomain}/products`}
                      className="text-sm text-white/60 hover:text-white transition-colors inline-block hover:translate-x-1 transform duration-200"
                      style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                    >
                      Our Products
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h4
                  className="font-semibold text-sm uppercase tracking-wider mb-5 text-white/90 flex items-center gap-2"
                  style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                >
                  <Leaf className="w-3.5 h-3.5 text-primary" />
                  Resources
                </h4>
                <ul className="space-y-3">
                  <li>
                    <Link
                      href={`/store/${tenant.subdomain}/contact`}
                      className="text-sm text-white/60 hover:text-white transition-colors inline-block hover:translate-x-1 transform duration-200"
                      style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                    >
                      Patient Access
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/store/${tenant.subdomain}/conditions`}
                      className="text-sm text-white/60 hover:text-white transition-colors inline-block hover:translate-x-1 transform duration-200"
                      style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                    >
                      Conditions Treated
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4
                  className="font-semibold text-sm uppercase tracking-wider mb-5 text-white/90 flex items-center gap-2"
                  style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                >
                  <Leaf className="w-3.5 h-3.5 text-primary" />
                  Legal
                </h4>
                <ul className="space-y-3">
                  <li>
                    <Link
                      href={`/store/${tenant.subdomain}/privacy`}
                      className="text-sm text-white/60 hover:text-white transition-colors inline-block hover:translate-x-1 transform duration-200"
                      style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                    >
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/store/${tenant.subdomain}/terms`}
                      className="text-sm text-white/60 hover:text-white transition-colors inline-block hover:translate-x-1 transform duration-200"
                      style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
                    >
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p
              className="text-white/50 text-xs"
              style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
            >
              © {currentYear} {businessName}. All rights reserved.
            </p>
            <p
              className="text-white/40 text-xs"
              style={{ fontFamily: 'var(--tenant-font-base, "Plus Jakarta Sans", sans-serif)' }}
            >
              Medical Cannabis Excellence
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
