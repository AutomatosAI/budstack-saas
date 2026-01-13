"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import { Tenant } from "@/types/client";
import { BlockchainTraceability } from "@/components/blockchain/BlockchainTraceability";

export default function BlockchainTechnologyPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant/current")
      .then((res) => res.json())
      .then((data) => {
        setTenant(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--tenant-color-background)" }}
      >
        <p className="text-lg" style={{ color: "var(--tenant-color-text)" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!tenant) {
    notFound();
  }

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
                  Blockchain Technology
                </h1>
                <p
                  className="text-xl md:text-2xl max-w-3xl font-light"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  Pioneering transparency and traceability in medical cannabis
                  through cutting-edge blockchain solutions
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Introduction Section */}
        <section
          className="py-16 md:py-20"
          style={{
            backgroundColor:
              "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.05)",
          }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="max-w-4xl mx-auto">
                <h2
                  className="text-3xl md:text-4xl font-semibold mb-8 tracking-tight"
                  style={{
                    color: "var(--tenant-color-heading)",
                    fontFamily: "var(--tenant-font-heading)",
                  }}
                >
                  Why Blockchain?
                </h2>
                <p
                  className="text-base md:text-lg leading-relaxed mb-6"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  At {tenant.businessName}, we believe that transparency is the
                  foundation of trust. By integrating blockchain technology into
                  our entire supply chain, we provide patients, healthcare
                  providers, and regulatory bodies with an immutable record of
                  every step in the production process.
                </p>
                <p
                  className="text-base md:text-lg leading-relaxed"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  Our blockchain infrastructure ensures that every cannabis
                  product can be traced from seed to patient, eliminating
                  counterfeits and guaranteeing the authenticity and quality of
                  our EU GMP-certified medical cannabis products.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Blockchain Traceability Timeline */}
        <BlockchainTraceability />

        {/* Benefits Section */}
        <section
          className="py-20 md:py-32"
          style={{
            backgroundColor:
              "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.05)",
          }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2
                className="text-3xl md:text-4xl font-semibold text-center mb-16 tracking-tight"
                style={{
                  color: "var(--tenant-color-heading)",
                  fontFamily: "var(--tenant-font-heading)",
                }}
              >
                Benefits of Our Blockchain System
              </h2>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  title: "Complete Transparency",
                  description:
                    "Every stage of cultivation, processing, and distribution is recorded on an immutable ledger, providing full visibility into product origins.",
                },
                {
                  title: "Anti-Counterfeiting",
                  description:
                    "Unique genome sequencing and blockchain verification make it impossible to counterfeit our products, protecting patient safety.",
                },
                {
                  title: "Regulatory Compliance",
                  description:
                    "Automatic documentation and audit trails ensure compliance with international pharmaceutical standards and regulatory requirements.",
                },
              ].map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div
                    className="rounded-xl p-8 border hover:shadow-lg transition-all duration-300"
                    style={{
                      backgroundColor: "var(--tenant-color-background)",
                      borderColor:
                        "var(--tenant-color-border, rgba(0,0,0,0.2))",
                    }}
                  >
                    <h3
                      className="text-xl font-semibold mb-4"
                      style={{
                        color: "var(--tenant-color-heading)",
                        fontFamily: "var(--tenant-font-heading)",
                      }}
                    >
                      {benefit.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{
                        color: "var(--tenant-color-text)",
                        fontFamily: "var(--tenant-font-base)",
                      }}
                    >
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
