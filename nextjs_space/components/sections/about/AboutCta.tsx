"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionProps } from "@/lib/types/section-props";
import { fadeInUp, staggerContainer } from "./motion";

/** About page closing CTA — heading, subtitle, pill button to contact.
 *  Markup extracted from the legacy about-content.tsx CTA section. */
export function AboutCta(props: SectionProps) {
  const { contactUrl, sectionConfig } = props;

  const heading = sectionConfig?.heading || "Ready to Learn More?";
  const subtitle =
    sectionConfig?.subtitle ||
    "Get in touch with our team to discuss how we can support your medical cannabis needs.";
  const ctaText = sectionConfig?.ctaText || "Contact Us";
  // Config href is tenant-controlled: allow relative paths, http(s), mailto
  // and tel only — anything else (javascript: etc.) falls back to contact.
  const rawHref = String(sectionConfig?.ctaHref || "");
  const ctaHref =
    /^(\/|https?:\/\/|mailto:|tel:)/i.test(rawHref.trim()) ? rawHref.trim() : contactUrl;

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2
            className="text-3xl md:text-4xl font-semibold mb-6 tracking-tight"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
            variants={fadeInUp}
          >
            {heading}
          </motion.h2>
          <motion.p
            className="text-base md:text-lg max-w-2xl mx-auto mb-10"
            style={{
              color: "hsl(var(--tenant-color-text))",
              fontFamily: "var(--tenant-font-base, sans-serif)",
            }}
            variants={fadeInUp}
          >
            {subtitle}
          </motion.p>
          <motion.div variants={fadeInUp}>
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold transition-all duration-200 hover:shadow-lg hover:scale-105"
              style={{
                backgroundColor: "hsl(var(--tenant-color-primary))",
                color: "white",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
            >
              {ctaText} <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
