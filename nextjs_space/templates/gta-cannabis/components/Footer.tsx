import React from 'react';
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from 'lucide-react';

interface FooterProps {
  businessName: string;
  consultationUrl: string;
  productsUrl: string;
  contactUrl: string;
}

export default function Footer({ businessName, consultationUrl, productsUrl, contactUrl }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden" style={{ backgroundColor: '#1A1A2E' }}>
      {/* Decorative Top Border */}
      <div className="h-2 sunset-gradient" />

      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-black text-white mb-4">{businessName}</h3>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Your trusted partner for premium medical cannabis products and professional guidance.
            </p>
            <div className="flex gap-4">
              {[
                { icon: Facebook, href: '#', color: '#4267B2' },
                { icon: Instagram, href: '#', color: '#E1306C' },
                { icon: Twitter, href: '#', color: '#1DA1F2' }
              ].map((social, index) => {
                const Icon = social.icon;
                return (
                  <a
                    key={index}
                    href={social.href}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    style={{
                      backgroundColor: `${social.color}20`,
                      border: `2px solid ${social.color}`
                    }}
                  >
                    <Icon size={20} style={{ color: social.color }} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold text-white mb-4">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { label: 'Browse Products', href: productsUrl },
                { label: 'Book Consultation', href: consultationUrl },
                { label: 'About Us', href: '/about' },
                { label: 'How It Works', href: '/how-it-works' }
              ].map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-teal-400 transition-colors animated-underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-lg font-bold text-white mb-4">Resources</h4>
            <ul className="space-y-3">
              {[
                { label: 'FAQ', href: '/faq' },
                { label: 'Conditions Treated', href: '/conditions' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' }
              ].map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-teal-400 transition-colors animated-underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-bold text-white mb-4">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-gray-400">
                <Mail size={20} className="mt-1" style={{ color: '#FF6B6B' }} />
                <a href="mailto:info@example.com" className="hover:text-teal-400 transition-colors">
                  info@example.com
                </a>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <Phone size={20} className="mt-1" style={{ color: '#4ECDC4' }} />
                <a href="tel:+1234567890" className="hover:text-teal-400 transition-colors">
                  +1 (234) 567-890
                </a>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <MapPin size={20} className="mt-1" style={{ color: '#FFE66D' }} />
                <span>123 Cannabis St,<br />Medical District</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © {currentYear} {businessName}. All rights reserved.
            </p>
            <p className="text-gray-500 text-sm">
              Powered by <span className="text-teal-400 font-semibold">BudStack</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
