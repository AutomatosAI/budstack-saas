"use client";

import { motion } from "framer-motion";
import { SectionProps } from "@/lib/types/section-props";
import { DEFAULT_ABOUT_TIMELINE } from "@/lib/templates/about-page";
import { fadeInUp, staggerContainer } from "./motion";

interface TimelineEntry {
  year: string;
  description: string;
}

/** About page journey timeline — alternating entries around a centre line.
 *  Markup extracted from the legacy about-content.tsx timeline section.
 *  An explicitly-empty entries array hides the section, matching the legacy
 *  `timeline && timeline.length > 0` guard; prefer the visibility toggle. */
export function AboutTimeline(props: SectionProps) {
  const { sectionConfig } = props;

  const heading = sectionConfig?.heading || "Our Journey";
  const raw = sectionConfig?.entries;
  const entries: TimelineEntry[] = Array.isArray(raw)
    ? raw
    : DEFAULT_ABOUT_TIMELINE;

  if (entries.length === 0) return null;

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2
            className="text-2xl md:text-3xl font-semibold mb-12 tracking-tight text-center"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
            variants={fadeInUp}
          >
            {heading}
          </motion.h2>

          <div className="relative">
            {/* Center line */}
            <div
              className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden md:block"
              style={{
                backgroundColor: "hsl(var(--tenant-color-primary) / 0.2)",
              }}
            />

            <div className="space-y-10">
              {entries.map((item, i) => (
                <motion.div
                  key={i}
                  className={`flex flex-col md:flex-row items-center gap-6 ${
                    i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                  variants={fadeInUp}
                >
                  <div
                    className={`flex-1 ${
                      i % 2 === 0 ? "md:text-right" : "md:text-left"
                    }`}
                  >
                    <span
                      className="inline-block px-3 py-1 rounded-full text-sm font-bold mb-2"
                      style={{
                        backgroundColor: "hsl(var(--tenant-color-primary) / 0.12)",
                        color: "hsl(var(--tenant-color-primary))",
                        fontFamily: "var(--tenant-font-heading, sans-serif)",
                      }}
                    >
                      {item.year}
                    </span>
                    <p
                      className="text-sm leading-relaxed"
                      style={{
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      {item.description}
                    </p>
                  </div>

                  {/* Center dot */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-4 h-4 rounded-full border-2"
                      style={{
                        borderColor: "hsl(var(--tenant-color-primary))",
                        backgroundColor: "hsl(var(--tenant-color-background))",
                      }}
                    />
                  </div>

                  <div className="flex-1 hidden md:block" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
