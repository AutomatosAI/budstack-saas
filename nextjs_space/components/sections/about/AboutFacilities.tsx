"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SectionProps } from "@/lib/types/section-props";
import { DEFAULT_ABOUT_FACILITIES } from "@/lib/templates/about-page";
import { fadeInUp, staggerContainer } from "./motion";

interface FacilityItem {
  title: string;
  description: string;
  /** Editor writes a newline-separated string; legacy data holds a string[]. */
  features?: string[] | string;
  image?: string;
}

function resolveFeatures(raw: FacilityItem["features"]): string[] {
  if (Array.isArray(raw)) return raw.map((f) => String(f).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(/\n+/)
      .map((f) => f.trim())
      .filter(Boolean);
  }
  return [];
}

/** About page facilities — solid-primary band with glassy facility cards.
 *  Markup extracted from the legacy about-content.tsx facilities section. */
export function AboutFacilities(props: SectionProps) {
  const { sectionConfig } = props;

  const heading = sectionConfig?.heading || "Our Facilities";
  const subtitle =
    sectionConfig?.subtitle ||
    "World-class operations meeting the highest international standards.";
  const raw = sectionConfig?.items;
  const items: FacilityItem[] =
    Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_ABOUT_FACILITIES;

  return (
    <section
      className="py-16 md:py-24"
      style={{ backgroundColor: "hsl(var(--tenant-color-primary))" }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-5xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2
            className="text-2xl md:text-3xl font-semibold text-white mb-4 tracking-tight text-center"
            style={{
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
            variants={fadeInUp}
          >
            {heading}
          </motion.h2>
          {subtitle && (
            <motion.p
              className="text-base text-white/80 mb-12 text-center max-w-2xl mx-auto"
              style={{
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              variants={fadeInUp}
            >
              {subtitle}
            </motion.p>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {items.map((facility, i) => {
              const features = resolveFeatures(facility.features);
              return (
                <motion.div
                  key={i}
                  className="bg-white/[0.06] backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 hover:bg-white/[0.1] transition-colors"
                  variants={fadeInUp}
                >
                  {facility.image && (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image
                        src={facility.image}
                        alt={facility.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  )}
                  <div className="p-7">
                    <h3
                      className="text-xl font-semibold text-white mb-3 tracking-tight"
                      style={{
                        fontFamily: "var(--tenant-font-heading, sans-serif)",
                      }}
                    >
                      {facility.title}
                    </h3>
                    <p
                      className="text-sm text-white/70 leading-relaxed mb-5"
                      style={{
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      {facility.description}
                    </p>
                    {features.length > 0 && (
                      <ul className="space-y-2">
                        {features.map((feature, fi) => (
                          <li key={fi} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
                            <span
                              className="text-sm text-white/80"
                              style={{
                                fontFamily: "var(--tenant-font-base, sans-serif)",
                              }}
                            >
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
