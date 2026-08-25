"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SectionProps } from "@/lib/types/section-props";
import { getIcon } from "@/lib/icon-registry";
import { Target } from "lucide-react";
import { fadeInUp, staggerContainer } from "./motion";

/** Paragraphs config accepts the editor's textarea string (blank-line
 *  separated) or a legacy string array from pageContent.about.missionParagraphs. */
function resolveParagraphs(raw: unknown, businessName: string): string[] {
  if (Array.isArray(raw)) {
    const cleaned = raw.map((p) => String(p).trim()).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return [
    `${businessName} was founded with a vision to improve patient access to high-quality medical cannabis. We believe every patient deserves safe, effective, and consistent medication backed by rigorous science.`,
    "Our team of medical professionals, researchers, and industry experts work together to ensure our products meet the highest pharmaceutical standards. From seed to patient, we maintain complete quality control.",
    "We are committed to advancing the science of medical cannabis through ongoing research, education, and collaboration with healthcare providers worldwide.",
  ];
}

/** About page mission/story — icon-badged heading, paragraphs, optional image.
 *  Markup extracted from the legacy about-content.tsx mission section. */
export function AboutMission(props: SectionProps) {
  const { tenant, sectionConfig } = props;

  const heading = sectionConfig?.heading || "Our Mission";
  const paragraphs = resolveParagraphs(
    sectionConfig?.paragraphs,
    tenant.businessName,
  );
  const imageUrl = sectionConfig?.imageUrl || null;
  const textAlign = sectionConfig?.textAlign || "left";
  const IconComp = getIcon(sectionConfig?.icon, Target);

  const headerJustify =
    textAlign === "center"
      ? "justify-center"
      : textAlign === "right"
        ? "justify-end"
        : "";

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-5xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.div
            className={`flex items-center gap-3 mb-8 ${headerJustify}`}
            variants={fadeInUp}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: "hsl(var(--tenant-color-primary) / 0.1)",
              }}
            >
              <IconComp
                className="w-6 h-6"
                style={{ color: "hsl(var(--tenant-color-primary))" }}
              />
            </div>
            <h2
              className="text-2xl md:text-3xl font-semibold tracking-tight"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
            >
              {heading}
            </h2>
          </motion.div>

          <div className={imageUrl ? "grid md:grid-cols-2 gap-10 items-start" : ""}>
            <div
              className="space-y-5"
              style={{ textAlign: textAlign as React.CSSProperties["textAlign"] }}
            >
              {paragraphs.map((text: string, i: number) => (
                <motion.p
                  key={i}
                  className="text-base md:text-lg leading-relaxed"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                  variants={fadeInUp}
                >
                  {text}
                </motion.p>
              ))}
            </div>

            {imageUrl && (
              <motion.div
                className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg"
                variants={fadeInUp}
              >
                <Image
                  src={imageUrl}
                  alt={heading}
                  fill
                  className="object-cover"
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
