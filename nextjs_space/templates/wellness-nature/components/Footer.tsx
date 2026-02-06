import React from 'react';
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin, Leaf } from 'lucide-react';
import Link from 'next/link';

interface FooterProps {
  businessName: string;
  consultationUrl: string;
  productsUrl: string;
  contactUrl: string;
}

export default function Footer({ businessName, consultationUrl, productsUrl, contactUrl }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: '#3C2F24', color: '#E8DCC8' }}>
      {/* Main Footer */}
      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#6B8E23' }}
              >
                <Leaf size={20} style={{ color: '#ffffff' }} />
              </div>
              <h3 className="text-2xl font-bold" style={{ color: '#ffffff' }}>
                {businessName}
              </h3>
            </div>
            <p className="mb-6" style={{ color: '#C4B5A0', lineHeight: '1.6' }}>
              Your trusted partner for natural wellness solutions. Quality, transparency, and care in every product.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                style={{ backgroundColor: 'rgba(107, 142, 35, 0.2)', border: '1px solid rgba(107, 142, 35, 0.3)' }}
              >
                <Facebook size={18} style={{ color: '#6B8E23' }} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                style={{ backgroundColor: 'rgba(107, 142, 35, 0.2)', border: '1px solid rgba(107, 142, 35, 0.3)' }}
              >
                <Instagram size={18} style={{ color: '#6B8E23' }} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                style={{ backgroundColor: 'rgba(107, 142, 35, 0.2)', border: '1px solid rgba(107, 142, 35, 0.3)' }}
              >
                <Twitter size={18} style={{ color: '#6B8E23' }} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold mb-4" style={{ color: '#ffffff' }}>Quick Links</h4>
            <ul className="space-y-3">
              {[
                { label: 'Our Products', url: productsUrl },
                { label: 'Consultation', url: consultationUrl },
                { label: 'About Us', url: '/about' },
                { label: 'Contact', url: contactUrl }
              ].map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.url}
                    className="transition-colors duration-300 hover:text-white"
                    style={{ color: '#C4B5A0' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-lg font-bold mb-4" style={{ color: '#ffffff' }}>Resources</h4>
            <ul className="space-y-3">
              {[
                { label: 'FAQ', url: '/faq' },
                { label: 'The Wire', url: '/the-wire' },
                { label: 'Privacy Policy', url: '/privacy' },
                { label: 'Terms & Conditions', url: '/terms' }
              ].map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.url}
                    className="transition-colors duration-300 hover:text-white"
                    style={{ color: '#C4B5A0' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-bold mb-4" style={{ color: '#ffffff' }}>Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Mail size={18} style={{ color: '#6B8E23', marginTop: '2px' }} />
                <span style={{ color: '#C4B5A0' }}>info@example.com</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone size={18} style={{ color: '#6B8E23', marginTop: '2px' }} />
                <span style={{ color: '#C4B5A0' }}>+351 123 456 789</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={18} style={{ color: '#6B8E23', marginTop: '2px' }} />
                <span style={{ color: '#C4B5A0' }}>Lisbon, Portugal</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{ borderTop: '1px solid rgba(196, 181, 160, 0.2)', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p style={{ color: '#C4B5A0', fontSize: '14px' }}>
              © {currentYear} {businessName}. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" style={{ color: '#C4B5A0', fontSize: '14px' }} className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" style={{ color: '#C4B5A0', fontSize: '14px' }} className="hover:text-white transition-colors">
                Terms & Conditions
              </Link>
              <Link href="/cookies" style={{ color: '#C4B5A0', fontSize: '14px' }} className="hover:text-white transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
