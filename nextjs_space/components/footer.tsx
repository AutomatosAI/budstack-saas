"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Shield,
  Award,
  Leaf,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Tenant } from "@/types/client";
import { TenantSettings } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

interface FooterProps {
  tenant?: Tenant | null;
  logoUrl?: string | null;
}

export function Footer({ tenant, logoUrl: logoUrlProp }: FooterProps = {}) {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  // Get tenant settings with defaults
  const settings = (tenant?.settings as TenantSettings) || {};
  const logoUrl = logoUrlProp || "/healingbuds-logo-white.jpeg";
  const brandName = tenant?.businessName || "HealingBuds";
  const tenantSlug = tenant?.subdomain || "healingbuds";

  // Business Info
  const businessInfo = settings?.businessInfo || {};
  const contactEmail = businessInfo.email || "info@healingbuds.pt";
  const contactPhone = businessInfo.phone || "+351 XXX XXX XXX";
  const emergencyLine = businessInfo.emergencyLine || contactPhone;
  const address = businessInfo.address || "Lisbon";
  const city = businessInfo.city || "Lisbon";
  const country = businessInfo.country || "Portugal";
  const supportHours = businessInfo.supportHours || "Mon-Fri: 9AM-6PM";

  // Footer Content
  const footer = settings?.footer || {};
  const footerDescription =
    footer.description ||
    "Safe, legal access to medical cannabis in Portugal. Providing personalized treatment plans through licensed healthcare professionals.";
  const copyrightText =
    footer.copyrightText ||
    `© ${currentYear} ${brandName}. All rights reserved.`;
  const servingArea = footer.servingArea || "Serving All of Portugal";
  const servingDetails =
    footer.servingDetails || "From Lisbon to Porto, Algarve to Braga";

  // Social Media
  const socialMedia = footer.socialMedia || {};

  // Business Hours
  const businessHours = settings?.businessHours || {};
  const mondayFriday =
    businessHours.monday && !businessHours.monday.closed
      ? `${businessHours.monday.open || "9:00"}-${businessHours.monday.close || "18:00"}`
      : null;

  // Dynamic footer styles using tenant theme colors
  const footerStyle = tenant
    ? {
        background: `linear-gradient(to bottom right, ${settings.primaryColor || "#1f2937"}, ${settings.secondaryColor || "#10b981"})`,
      }
    : {
        background: "linear-gradient(to bottom right, #1f2937, #10b981)",
      };

  return (
    <footer className="text-white" style={footerStyle}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Company Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-3">
                <div className="relative w-10 h-10">
                  <Image
                    src={logoUrl}
                    alt={`${brandName} Logo`}
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-serif">{brandName}</h3>
                  <p
                    className="text-sm flex items-center gap-1"
                    style={{ color: settings.accentColor || "#86efac" }}
                  >
                    <Shield className="w-3 h-3" />
                    INFARMED Regulated
                  </p>
                </div>
              </div>

              <p className="text-gray-300 text-sm leading-relaxed">
                {footer.description || t("footer.description")}
              </p>

              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-yellow-300">
                  EU-GMP Certified
                </span>
              </div>
            </motion.div>

            {/* Quick Links */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              <h4
                className="text-lg font-semibold"
                style={{ color: settings.accentColor || "#86efac" }}
              >
                {t("footer.quickLinks")}
              </h4>
              <nav className="space-y-3">
                <Link
                  href={`/store/${tenantSlug}/how-it-works`}
                  className="block text-gray-300 hover:text-white hover:translate-x-1 transition-all duration-200"
                >
                  {t("nav.howItWorks")}
                </Link>
                <Link
                  href={`/store/${tenantSlug}/conditions`}
                  className="block text-gray-300 hover:text-white hover:translate-x-1 transition-all duration-200"
                >
                  {t("conditions.title")}
                </Link>
                <Link
                  href={`/store/${tenantSlug}/products`}
                  className="block text-gray-300 hover:text-white hover:translate-x-1 transition-all duration-200"
                >
                  {t("products.title")}
                </Link>
                <Link
                  href={`/store/${tenantSlug}/consultation`}
                  className="block text-gray-300 hover:text-white hover:translate-x-1 transition-all duration-200"
                >
                  {t("nav.consultation")}
                </Link>
                <Link
                  href={`/store/${tenantSlug}/blog`}
                  className="block text-gray-300 hover:text-white hover:translate-x-1 transition-all duration-200"
                >
                  {t("blog.title")}
                </Link>
              </nav>
            </motion.div>

            {/* Support */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <h4
                className="text-lg font-semibold"
                style={{ color: settings.accentColor || "#86efac" }}
              >
                {t("footer.legal")}
              </h4>
              <nav className="space-y-3">
                <Link
                  href={`/store/${tenantSlug}/faq`}
                  className="block text-gray-300 hover:text-white hover:translate-x-1 transition-all duration-200"
                >
                  {t("faq.title")}
                </Link>
                <Link
                  href={`/store/${tenantSlug}/contact`}
                  className="block text-gray-300 hover:text-white hover:translate-x-1 transition-all duration-200"
                >
                  {t("contact.title")}
                </Link>
                <Link
                  href="/dashboard"
                  className="block text-gray-300 hover:text-white hover:translate-x-1 transition-all duration-200"
                >
                  {t("nav.dashboard")}
                </Link>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{supportHours}</span>
                </div>
              </nav>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="space-y-6"
            >
              <h4
                className="text-lg font-semibold"
                style={{ color: settings.accentColor || "#86efac" }}
              >
                {t("footer.contact")}
              </h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Phone
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    style={{ color: settings.accentColor || "#86efac" }}
                  />
                  <div>
                    <p className="text-white font-medium">{contactPhone}</p>
                    <p className="text-sm text-gray-300">24/7 Emergency Line</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    style={{ color: settings.accentColor || "#86efac" }}
                  />
                  <div>
                    <Link
                      href={`mailto:${contactEmail}`}
                      className="text-white hover:opacity-80 transition-opacity"
                    >
                      {contactEmail}
                    </Link>
                    <p className="text-sm text-gray-300">Patient Support</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    style={{ color: settings.accentColor || "#86efac" }}
                  />
                  <div>
                    <p className="text-white">
                      {city}, {country}
                    </p>
                    <p className="text-sm text-gray-300">{servingArea}</p>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              {(socialMedia.facebook ||
                socialMedia.instagram ||
                socialMedia.twitter ||
                socialMedia.linkedin) && (
                <div className="pt-4">
                  <p className="text-sm text-gray-300 mb-3">Follow Us</p>
                  <div className="flex space-x-3">
                    {socialMedia.facebook && (
                      <a
                        href={socialMedia.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <Facebook className="w-5 h-5" />
                      </a>
                    )}
                    {socialMedia.instagram && (
                      <a
                        href={socialMedia.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {socialMedia.twitter && (
                      <a
                        href={socialMedia.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                    {socialMedia.linkedin && (
                      <a
                        href={socialMedia.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <Linkedin className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-green-800/50 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <MapPin
                className="w-4 h-4"
                style={{ color: settings.accentColor || "#86efac" }}
              />
              <span className="font-medium text-white">{servingArea}</span>
              <span>{servingDetails}</span>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
              <Link
                href={`/store/${tenantSlug}/privacy`}
                className="hover:text-white transition-colors"
              >
                {t("footer.privacyPolicy")}
              </Link>
              <Link
                href={`/store/${tenantSlug}/terms`}
                className="hover:text-white transition-colors"
              >
                {t("footer.termsOfService")}
              </Link>
              <Link
                href={`/store/${tenantSlug}/cookies`}
                className="hover:text-white transition-colors"
              >
                {t("footer.cookiePolicy")}
              </Link>
              <span className="flex items-center gap-2">
                <Shield
                  className="w-4 h-4"
                  style={{ color: settings.accentColor || "#86efac" }}
                />
                SSL Secured
              </span>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-400">
            {copyrightText}
          </div>
        </div>
      </div>
    </footer>
  );
}
