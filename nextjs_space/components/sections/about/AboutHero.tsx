"use client";

import { motion } from "framer-motion";
import { SectionProps } from "@/lib/types/section-props";
import { fadeInUp, staggerContainer } from "./motion";

/** About page hero — eyebrow badge, page title, subtitle.
 *  Markup extracted from the legacy about-content.tsx hero section;
 *  defaults reproduce it exactly when no config is set. */
export function AboutHero(props: SectionProps) {
  const { tenant, sectionConfig } = props;
  const businessName = tenant.businessName;

  const badge = sectionConfig?.badge || "Our Story";
  const heading = sectionConfig?.heading || `About ${businessName}`;
  const subtitle =
    sectionConfig?.subtitle ||
    "Setting new standards in medical cannabis excellence";
  const textAlign = sectionConfig?.textAlign || "center";

  return (
    <section
      className="pt-28 md:pt-36 pb-16 md:pb-24"
      style={{
        background:
          "linear-gradient(to bottom, hsl(var(--tenant-color-primary) / 0.08), transparent)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-4xl mx-auto"
          style={{ textAlign: textAlign as React.CSSProperties["textAlign"] }}
        >
          {badge && (
            <motion.div variants={fadeInUp} className="mb-6">
              <span
                className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-primary) / 0.1)",
                  color: "hsl(var(--tenant-color-primary))",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                {badge}
              </span>
            </motion.div>
          )}
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight leading-[1.1]"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
            variants={fadeInUp}
          >
            {heading}
          </motion.h1>
          <motion.p
            className="text-lg md:text-xl max-w-3xl mx-auto font-light"
            style={{
              color: "hsl(var(--tenant-color-text))",
              fontFamily: "var(--tenant-font-base, sans-serif)",
            }}
            variants={fadeInUp}
          >
            {subtitle}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
