"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Target,
  Heart,
  Globe,
  Shield,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const defaultValues = [
  {
    icon: "Target",
    title: "Excellence",
    desc: "Uncompromising quality in every product and process",
  },
  {
    icon: "Heart",
    title: "Patient-Focused",
    desc: "Putting patient needs and wellbeing at the heart of everything we do",
  },
  {
    icon: "Globe",
    title: "Global Reach",
    desc: "Serving patients across continents with consistent standards",
  },
  {
    icon: "Shield",
    title: "Integrity",
    desc: "Operating with transparency, compliance, and ethical responsibility",
  },
];

const defaultStats = [
  { value: "10,000+", label: "Patients Served" },
  { value: "50+", label: "Products Available" },
  { value: "100%", label: "Quality Certified" },
  { value: "24/7", label: "Patient Support" },
];

const defaultFacilities = [
  {
    title: "Cultivation & Processing",
    description:
      "State-of-the-art cultivation and processing facility meeting the highest international quality standards.",
    features: [
      "GMP-certified production",
      "Advanced indoor growing systems",
      "Quality control laboratories",
      "Sustainable practices",
    ],
  },
  {
    title: "Distribution & Fulfilment",
    description:
      "Efficient distribution network ensuring timely, secure delivery of medical cannabis products to patients.",
    features: [
      "Temperature-controlled storage",
      "Tracked delivery systems",
      "Regulatory compliance",
      "Discreet packaging",
    ],
  },
];

const defaultTimeline = [
  { year: "Founded", description: "Established with a mission to improve patient access to medical cannabis" },
  { year: "Licensed", description: "Obtained all regulatory approvals and licensing for medical cannabis operations" },
  { year: "Expanded", description: "Grew our product range and extended our services to more patients" },
  { year: "Today", description: "Continuing to innovate and improve patient outcomes through quality cannabis medicine" },
];

const iconMap: Record<string, any> = {
  Target,
  Heart,
  Globe,
  Shield,
};

interface AboutContentProps {
  basePath: string;
  businessName: string;
  pageContent?: any;
}

export default function AboutContent({
  basePath,
  businessName,
  pageContent,
}: AboutContentProps) {
  const heroTitle = pageContent?.heroTitle || `About ${businessName}`;
  const heroSubtitle =
    pageContent?.heroSubtitle ||
    "Setting new standards in medical cannabis excellence";
  const missionImage = pageContent?.missionImage || null;
  const missionTitle = pageContent?.missionTitle || "Our Mission";
  const missionParagraphs = pageContent?.missionParagraphs || [
    `${businessName} was founded with a vision to improve patient access to high-quality medical cannabis. We believe every patient deserves safe, effective, and consistent medication backed by rigorous science.`,
    "Our team of medical professionals, researchers, and industry experts work together to ensure our products meet the highest pharmaceutical standards. From seed to patient, we maintain complete quality control.",
    "We are committed to advancing the science of medical cannabis through ongoing research, education, and collaboration with healthcare providers worldwide.",
  ];
  const stats = pageContent?.stats || defaultStats;
  const values = pageContent?.values || defaultValues;
  const facilities = pageContent?.facilities || defaultFacilities;
  const timeline = pageContent?.timeline || defaultTimeline;
  const ctaTitle = pageContent?.ctaTitle || "Ready to Learn More?";
  const ctaSubtitle =
    pageContent?.ctaSubtitle ||
    "Get in touch with our team to discuss how we can support your medical cannabis needs.";

  return (
    <>
      {/* Hero Section */}
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
            className="max-w-4xl mx-auto text-center"
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span
                className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  backgroundColor:
                    "hsl(var(--tenant-color-primary) / 0.1)",
                  color: "hsl(var(--tenant-color-primary))",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                Our Story
              </span>
            </motion.div>
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight leading-[1.1]"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
              variants={fadeInUp}
            >
              {heroTitle}
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl max-w-3xl mx-auto font-light"
              style={{
                color: "hsl(var(--tenant-color-text))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              variants={fadeInUp}
            >
              {heroSubtitle}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Mission / Story */}
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
              className="flex items-center gap-3 mb-8"
              variants={fadeInUp}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor:
                    "hsl(var(--tenant-color-primary) / 0.1)",
                }}
              >
                <Target
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
                {missionTitle}
              </h2>
            </motion.div>

            <div className={missionImage ? "grid md:grid-cols-2 gap-10 items-start" : ""}>
              <div className="space-y-5">
                {missionParagraphs.map((text: string, i: number) => (
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

              {missionImage && (
                <motion.div
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg"
                  variants={fadeInUp}
                >
                  <Image
                    src={missionImage}
                    alt={missionTitle}
                    fill
                    className="object-cover"
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
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
            {stats.map(
              (stat: { value: string; label: string }, i: number) => (
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
              )
            )}
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="text-2xl md:text-3xl font-semibold text-center mb-14 tracking-tight"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Our Values
          </motion.h2>
          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {values.map(
              (
                item: { icon: string; title: string; desc: string },
                i: number
              ) => {
                const IconComp = iconMap[item.icon] || Target;
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
                        fontFamily:
                          "var(--tenant-font-heading, sans-serif)",
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
                      {item.desc}
                    </p>
                  </motion.div>
                );
              }
            )}
          </motion.div>
        </div>
      </section>

      {/* Facilities */}
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
              Our Facilities
            </motion.h2>
            <motion.p
              className="text-base text-white/80 mb-12 text-center max-w-2xl mx-auto"
              style={{
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              variants={fadeInUp}
            >
              World-class operations meeting the highest international standards.
            </motion.p>

            <div className="grid md:grid-cols-2 gap-6">
              {facilities.map(
                (
                  facility: {
                    title: string;
                    description: string;
                    features: string[];
                    image?: string;
                  },
                  i: number
                ) => (
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
                          fontFamily:
                            "var(--tenant-font-heading, sans-serif)",
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
                      <ul className="space-y-2">
                        {facility.features.map(
                          (feature: string, fi: number) => (
                            <li
                              key={fi}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
                              <span
                                className="text-sm text-white/80"
                                style={{
                                  fontFamily:
                                    "var(--tenant-font-base, sans-serif)",
                                }}
                              >
                                {feature}
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </motion.div>
                )
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Timeline (only if data exists) */}
      {timeline && timeline.length > 0 && (
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
                Our Journey
              </motion.h2>

              <div className="relative">
                {/* Center line */}
                <div
                  className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden md:block"
                  style={{
                    backgroundColor:
                      "hsl(var(--tenant-color-primary) / 0.2)",
                  }}
                />

                <div className="space-y-10">
                  {timeline.map(
                    (
                      item: { year: string; description: string },
                      i: number
                    ) => (
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
                              fontFamily:
                                "var(--tenant-font-heading, sans-serif)",
                            }}
                          >
                            {item.year}
                          </span>
                          <p
                            className="text-sm leading-relaxed"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily:
                                "var(--tenant-font-base, sans-serif)",
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
                              borderColor:
                                "hsl(var(--tenant-color-primary))",
                              backgroundColor:
                                "hsl(var(--tenant-color-background))",
                            }}
                          />
                        </div>

                        <div className="flex-1 hidden md:block" />
                      </motion.div>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* CTA Section */}
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
              {ctaTitle}
            </motion.h2>
            <motion.p
              className="text-base md:text-lg max-w-2xl mx-auto mb-10"
              style={{
                color: "hsl(var(--tenant-color-text))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              variants={fadeInUp}
            >
              {ctaSubtitle}
            </motion.p>
            <motion.div variants={fadeInUp}>
              <Link
                href={`${basePath}/contact`}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold transition-all duration-200 hover:shadow-lg hover:scale-105"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-primary))",
                  color: "white",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                Contact Us <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
