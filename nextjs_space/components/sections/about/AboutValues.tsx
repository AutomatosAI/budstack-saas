"use client";

import { motion } from "framer-motion";
import { Target, Heart, Globe, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionProps } from "@/lib/types/section-props";
import { getIcon } from "@/lib/icon-registry";
import { DEFAULT_ABOUT_VALUES } from "@/lib/templates/about-page";
import { fadeInUp, staggerContainer } from "./motion";

interface ValueItem {
  icon?: string;
  title: string;
  /** Editor writes `description`; legacy pageContent.about.values used `desc`. */
  description?: string;
  desc?: string;
}

/** The legacy page resolved icons from this fixed map. Globe is not in the
 *  shared icon registry, so keep these as a first-choice lookup before
 *  falling through to getIcon for registry names picked in the editor. */
const legacyIconMap: Record<string, LucideIcon> = {
  Target,
  Heart,
  Globe,
  Shield,
};

/** About page values grid — gradient icon tiles with title + copy.
 *  Markup extracted from the legacy about-content.tsx values section. */
export function AboutValues(props: SectionProps) {
  const { sectionConfig } = props;

  const heading = sectionConfig?.heading || "Our Values";
  const textAlign = sectionConfig?.textAlign || "center";
  const raw = sectionConfig?.items;
  const items: ValueItem[] =
    Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_ABOUT_VALUES;

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {heading && (
          <motion.h2
            className="text-2xl md:text-3xl font-semibold mb-14 tracking-tight"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
              textAlign: textAlign as React.CSSProperties["textAlign"],
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {heading}
          </motion.h2>
        )}
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          {items.map((item, i) => {
            const IconComp = legacyIconMap[item.icon || ""] || getIcon(item.icon, Target);
            return (
              <motion.div
                key={i}
                className="text-center group"
                variants={fadeInUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-md group-hover:shadow-lg transition-shadow"
                  style={{
                    background:
                      "linear-gradient(to bottom right, hsl(var(--tenant-color-primary)), hsl(var(--tenant-color-primary) / 0.7))",
                  }}
                >
                  <IconComp className="w-7 h-7 text-white" />
                </div>
                <h3
                  className="text-lg font-semibold mb-2 tracking-tight"
                  style={{
                    color: "hsl(var(--tenant-color-heading))",
                    fontFamily: "var(--tenant-font-heading, sans-serif)",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  {item.description ?? item.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
