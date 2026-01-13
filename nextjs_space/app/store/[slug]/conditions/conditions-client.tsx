"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { Tenant } from "@/types/client";

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

export default function ConditionsClient({
  tenant,
  conditions,
}: ConditionsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Extract unique categories dynamically from the fetched conditions
  const uniqueCategories = Array.from(
    new Set(conditions.map((c) => c.categoryKey)),
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
      style={{ backgroundColor: "var(--tenant-color-background)" }}
    >
      <main className="pt-28 md:pt-32">
        {/* Hero Section */}
        <section
          style={{ backgroundColor: "var(--tenant-color-background)" }}
          className="py-16 md:py-20"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="max-w-5xl">
                <h1
                  className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight leading-[1.1]"
                  style={{
                    color: "var(--tenant-color-heading)",
                    fontFamily: "var(--tenant-font-heading)",
                  }}
                >
                  Conditions We Treat
                </h1>
                <p
                  className="text-xl md:text-2xl max-w-3xl font-light mb-8"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  Explore how medical cannabis can help manage your condition.
                  Learn about symptoms, treatments, and personalized care
                  options.
                </p>
                <p
                  className="text-lg max-w-3xl font-light"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  Note: This information is for educational purposes only.
                  Consult with our medical professionals for personalized
                  advice.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Search and Filter Section */}
        <section
          className="py-12"
          style={{
            backgroundColor:
              "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.05)",
          }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Search Bar */}
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: "var(--tenant-color-text)", opacity: 0.5 }}
                  />
                  <input
                    type="text"
                    placeholder="Search conditions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-200"
                    style={{
                      backgroundColor: "var(--tenant-color-background)",
                      borderColor:
                        "var(--tenant-color-border, rgba(0,0,0,0.2))",
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  />
                </div>

                {/* Conditions Grid */}
                <section className="py-20 md:py-32" style={{ backgroundColor: 'var(--tenant-color-background)' }}>
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
                                            layout: { duration: 0.3 }
                                        }}
                                    >
                                        <Link href={`/store/${tenant.subdomain}/conditions/${condition.slug}`}>
                                            <div
                                                className="group block rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border"
                                                style={{
                                                    backgroundColor: 'var(--tenant-color-surface, var(--tenant-color-background))',
                                                    borderColor: 'var(--tenant-color-border, rgba(0,0,0,0.2))'
                                                }}
                                            >
                                                <div className="h-48 overflow-hidden relative">
                                                    <Image
                                                        src={condition.image || '/placeholder-condition.jpg'}
                                                        alt={condition.name}
                                                        fill
                                                        className="object-contain p-6 group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                </div>
                                                <div className="p-5">
                                                    <h3
                                                        className="text-xl font-semibold mb-2 group-hover:opacity-80 transition-colors"
                                                        style={{ color: 'var(--tenant-color-heading)', fontFamily: 'var(--tenant-font-heading)' }}
                                                    >
                                                        {condition.name}
                                                    </h3>
                                                    <p
                                                        className="text-sm"
                                                        style={{ color: 'var(--tenant-color-text)', fontFamily: 'var(--tenant-font-base)' }}
                                                    >
                                                        {condition.category}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>

        {/* Conditions Grid */}
        <section
          className="py-20 md:py-32"
          style={{ backgroundColor: "var(--tenant-color-background)" }}
        >
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
                      <div
                        className="group block rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border"
                        style={{
                          backgroundColor:
                            "var(--tenant-color-surface, var(--tenant-color-background))",
                          borderColor:
                            "var(--tenant-color-border, rgba(0,0,0,0.2))",
                        }}
                      >
                        <div className="h-48 overflow-hidden relative">
                          <Image
                            src={
                              condition.image || "/placeholder-condition.jpg"
                            }
                            alt={condition.name}
                            fill
                            className="object-contain p-6 group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="p-5">
                          <h3
                            className="text-xl font-semibold mb-2 group-hover:opacity-80 transition-colors"
                            style={{
                              color: "var(--tenant-color-heading)",
                              fontFamily: "var(--tenant-font-heading)",
                            }}
                          >
                            {condition.name}
                          </h3>
                          <p
                            className="text-sm"
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            {condition.category}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {filteredConditions.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="text-center py-16">
                  <p
                    className="text-xl"
                    style={{
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    No conditions found matching your search.
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-20 md:py-32"
          style={{ backgroundColor: "var(--tenant-color-primary)" }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="max-w-4xl mx-auto text-center">
                <h2
                  className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 tracking-tight text-white"
                  style={{ fontFamily: "var(--tenant-font-heading)" }}
                >
                  Ready to Explore Treatment Options?
                </h2>
                <p
                  className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-white opacity-90"
                  style={{ fontFamily: "var(--tenant-font-base)" }}
                >
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                        >
                            <div className="max-w-4xl mx-auto text-center">
                                <h2
                                    className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 tracking-tight text-white"
                                    style={{ fontFamily: 'var(--tenant-font-heading)' }}
                                >
                                    Ready to Explore Treatment Options?
                                </h2>
                                <p
                                    className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-white opacity-90"
                                    style={{ fontFamily: 'var(--tenant-font-base)' }}
                                >
                                    Schedule a consultation with our medical professionals to discuss personalized treatment plans.
                                </p>
                                <Link href={`/store/${tenant.subdomain}/contact`}>
                                    <button
                                        className="px-8 py-3 text-lg rounded-lg font-semibold border transition-all duration-200 hover:shadow-lg"
                                        style={{
                                            backgroundColor: 'white',
                                            color: 'var(--tenant-color-primary)',
                                            fontFamily: 'var(--tenant-font-base)'
                                        }}
                                    >
                                        Contact Us →
                                    </button>
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </main>
        </div>
    );
}
