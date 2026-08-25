"use client";

import { motion } from "framer-motion";
import { SectionProps } from "@/lib/types/section-props";
import { DEFAULT_ABOUT_STATS } from "@/lib/templates/about-page";
import { fadeInUp, staggerContainer } from "./motion";

interface StatItem {
  value: string;
  label: string;
}

/** About page stats band — 2/4-column figures on a primary-tinted background.
 *  Markup extracted from the legacy about-content.tsx stats section. */
export function AboutStats(props: SectionProps) {
  const { sectionConfig } = props;

  const raw = sectionConfig?.items;
  const items: StatItem[] =
    Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_ABOUT_STATS;

  return (
    <section
      className="py-16 md:py-24"
      style={{
        backgroundColor: "hsl(var(--tenant-color-primary) / 0.04)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          {items.map((stat, i) => (
            <motion.div key={i} className="text-center" variants={fadeInUp}>
              <h3
                className="text-3xl md:text-4xl font-bold mb-2"
                style={{
                  color: "hsl(var(--tenant-color-primary))",
                  fontFamily: "var(--tenant-font-heading, sans-serif)",
                }}
              >
                {stat.value}
              </h3>
              <p
                className="text-sm md:text-base"
                style={{
                  color: "hsl(var(--tenant-color-text))",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
