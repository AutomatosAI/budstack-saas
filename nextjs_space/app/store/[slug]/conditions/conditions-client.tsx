"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FlaskConical, BookOpen, Award, Users } from "lucide-react";
import { Tenant } from "@/types/client";
import { getTenantBasePath } from "@/lib/tenant-utils";

interface Condition {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  category: string;
  categoryKey: string;
  description: string | null;
}

interface ConditionsClientProps {
  tenant: Tenant;
  conditions: Condition[];
}

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const defaultResearchCards = [
  {
    icon: FlaskConical,
    title: "Clinical Research",
    desc: "Evidence-based treatment protocols backed by peer-reviewed studies",
  },
  {
    icon: BookOpen,
    title: "Patient Education",
    desc: "Comprehensive resources to help you understand your treatment options",
  },
  {
    icon: Award,
    title: "Quality Standards",
    desc: "All products meet pharmaceutical-grade quality and safety standards",
  },
  {
    icon: Users,
    title: "Expert Team",
    desc: "Consultations with experienced medical cannabis specialists",
  },
];

export default function ConditionsClient({
  tenant,
  conditions,
}: ConditionsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const basePath = getTenantBasePath(tenant.subdomain);

  const pageContent = (tenant as any).pageContent?.conditions;
  const heroTitle = pageContent?.heroTitle || "Conditions We Treat";
  const heroSubtitle =
    pageContent?.heroSubtitle ||
    "Advancing patient care through rigorous research and evidence-based cannabis medicine. Explore the conditions we support.";
  const introParagraphs = pageContent?.introParagraphs || [
    "Medical cannabis has shown therapeutic potential across a wide range of conditions. Our team works with leading researchers and clinicians to ensure every recommendation is backed by the latest scientific evidence.",
    "Whether you're exploring options for chronic pain, neurological conditions, or mental health support, our comprehensive library covers the conditions most commonly treated with medical cannabis.",
  ];
  const researchCards = pageContent?.researchCards || defaultResearchCards;
  const ctaTitle = pageContent?.ctaTitle || "Not sure if you qualify?";
  const ctaSubtitle =
    pageContent?.ctaSubtitle ||
    "Take our quick eligibility assessment to find out if medical cannabis could be right for you.";
  const ctaButton = pageContent?.ctaButton || "Check Eligibility";

  // Extract unique categories dynamically from the fetched conditions
  const uniqueCategories = Array.from(
    new Set(conditions.map((c) => c.categoryKey))
  ).map((key) => {
    const condition = conditions.find((c) => c.categoryKey === key);
    return { key, label: condition?.category || key };
  });

  const categories = [
    { key: "all", label: "All Conditions" },
    ...uniqueCategories.sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const filteredConditions = conditions.filter((condition) => {
    const matchesCategory =
      selectedCategory === "all" || condition.categoryKey === selectedCategory;
    const matchesSearch = condition.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main className="pt-28 md:pt-32">
        {/* Hero Section */}
        <section
          className="py-16 md:py-24"
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

        {/* Intro Text */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="max-w-4xl mx-auto space-y-5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              {introParagraphs.map((text: string, i: number) => (
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
            </motion.div>
          </div>
        </section>

        {/* Research Cards */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              {researchCards.map(
                (
                  card: { icon: any; title: string; desc: string },
                  i: number
                ) => {
                  const IconComponent =
                    typeof card.icon === "string"
                      ? { FlaskConical, BookOpen, Award, Users }[card.icon] ||
                        FlaskConical
                      : card.icon;
                  return (
                    <motion.div
                      key={i}
                      className="rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow"
                      style={{
                        backgroundColor:
                          "hsl(var(--tenant-color-primary) / 0.05)",
                        border:
                          "1px solid hsl(var(--tenant-color-primary) / 0.1)",
                      }}
                      variants={fadeInUp}
                    >
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{
                          backgroundColor:
                            "hsl(var(--tenant-color-primary) / 0.1)",
                        }}
                      >
                        <IconComponent
                          className="w-7 h-7"
                          style={{ color: "hsl(var(--tenant-color-primary))" }}
                        />
                      </div>
                      <h3
                        className="text-lg font-semibold mb-2"
                        style={{
                          color: "hsl(var(--tenant-color-heading))",
                          fontFamily: "var(--tenant-font-heading, sans-serif)",
                        }}
                      >
                        {card.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed"
                        style={{
                          color: "hsl(var(--tenant-color-text))",
                          fontFamily: "var(--tenant-font-base, sans-serif)",
                        }}
                      >
                        {card.desc}
                      </p>
                    </motion.div>
                  );
                }
              )}
            </motion.div>
          </div>
        </section>

        {/* Search + Category Pills */}
        <section
          className="py-12"
          style={{
            backgroundColor: "hsl(var(--tenant-color-primary) / 0.04)",
          }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Search Bar */}
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      opacity: 0.5,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search conditions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-200"
                    style={{
                      backgroundColor: "hsl(var(--tenant-color-background))",
                      borderColor:
                        "hsl(var(--tenant-color-primary) / 0.2)",
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  />
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {categories.map((category) => (
                    <button
                      key={category.key}
                      onClick={() => setSelectedCategory(category.key)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        selectedCategory === category.key
                          ? "shadow-md"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor:
                          selectedCategory === category.key
                            ? "hsl(var(--tenant-color-primary))"
                            : "hsl(var(--tenant-color-background))",
                        color:
                          selectedCategory === category.key
                            ? "white"
                            : "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                        border:
                          selectedCategory !== category.key
                            ? "1px solid hsl(var(--tenant-color-primary) / 0.2)"
                            : "1px solid transparent",
                      }}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Conditions Grid */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              layout
              className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto"
            >
              <AnimatePresence mode="popLayout">
                {filteredConditions.map((condition) => (
                  <motion.div
                    key={condition.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{
                      duration: 0.3,
                      layout: { duration: 0.3 },
                    }}
                  >
                    <Link href={`conditions/${condition.slug}`}>
                      {condition.image ? (
                        /* Image overlay variant */
                        <div
                          className="group block rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative aspect-[4/3]"
                        >
                          <Image
                            src={condition.image}
                            alt={condition.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 p-5">
                            <h3
                              className="text-lg font-semibold mb-1 text-white"
                              style={{
                                fontFamily:
                                  "var(--tenant-font-heading, sans-serif)",
                              }}
                            >
                              {condition.name}
                            </h3>
                            <p
                              className="text-sm text-white/80"
                              style={{
                                fontFamily: "var(--tenant-font-base, sans-serif)",
                              }}
                            >
                              {condition.category}
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* No-image card variant */
                        <div
                          className="group block rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border"
                          style={{
                            backgroundColor: "hsl(var(--tenant-color-background))",
                            borderColor:
                              "hsl(var(--tenant-color-primary) / 0.12)",
                          }}
                        >
                          <div
                            className="h-48 overflow-hidden relative"
                            style={{
                              background:
                                "linear-gradient(135deg, hsl(var(--tenant-color-primary) / 0.1), hsl(var(--tenant-color-primary) / 0.03))",
                            }}
                          >
                            <Image
                              src="/placeholder-condition.jpg"
                              alt={condition.name}
                              fill
                              className="object-contain p-6 group-hover:scale-105 transition-transform duration-500"
                            />
                            <div
                              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                              style={{
                                background:
                                  "linear-gradient(to top, hsl(var(--tenant-color-primary) / 0.15), transparent)",
                              }}
                            />
                          </div>
                          <div className="p-5">
                            <h3
                              className="text-lg font-semibold mb-1 group-hover:opacity-80 transition-colors"
                              style={{
                                color: "hsl(var(--tenant-color-heading))",
                                fontFamily:
                                  "var(--tenant-font-heading, sans-serif)",
                              }}
                            >
                              {condition.name}
                            </h3>
                            <p
                              className="text-sm"
                              style={{
                                color: "hsl(var(--tenant-color-primary))",
                                fontFamily: "var(--tenant-font-base, sans-serif)",
                              }}
                            >
                              {condition.category}
                            </p>
                          </div>
                        </div>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {filteredConditions.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="text-center py-16">
                  <Search
                    className="w-12 h-12 mx-auto mb-4 opacity-30"
                    style={{ color: "hsl(var(--tenant-color-text))" }}
                  />
                  <p
                    className="text-xl mb-2"
                    style={{
                      color: "hsl(var(--tenant-color-heading))",
                      fontFamily: "var(--tenant-font-heading, sans-serif)",
                    }}
                  >
                    No conditions found
                  </p>
                  <p
                    className="text-sm"
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    Try adjusting your search or filter criteria.
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-16 md:py-24"
          style={{ backgroundColor: "hsl(var(--tenant-color-primary))" }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="max-w-4xl mx-auto text-center"
            >
              <motion.h2
                className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 tracking-tight text-white"
                style={{ fontFamily: "var(--tenant-font-heading, sans-serif)" }}
                variants={fadeInUp}
              >
                {ctaTitle}
              </motion.h2>
              <motion.p
                className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-white/90"
                style={{ fontFamily: "var(--tenant-font-base, sans-serif)" }}
                variants={fadeInUp}
              >
                {ctaSubtitle}
              </motion.p>
              <motion.div variants={fadeInUp}>
                <Link
                  href={`${basePath}/consultation`}
                  className="inline-block px-8 py-3 text-lg rounded-lg font-semibold transition-all duration-200 hover:shadow-lg hover:scale-105"
                  style={{
                    backgroundColor: "white",
                    color: "hsl(var(--tenant-color-primary))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  {ctaButton} →
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
