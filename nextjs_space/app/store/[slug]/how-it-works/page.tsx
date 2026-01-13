"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Tenant } from "@/types/client";

export default function HowItWorksPage() {
  const { t } = useLanguage();
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-lg text-gray-600">{t("common.loading")}</p>
      </div>
    );
  }

  if (!tenant) {
    notFound();
  }

  const steps = [
    {
      number: 1,
      title: t("howItWorks.step1.longTitle"),
      description: t("howItWorks.step1.longDesc"),
    },
    {
      number: 2,
      title: t("howItWorks.step2.longTitle"),
      description: t("howItWorks.step2.longDesc"),
    },
    {
      number: 3,
      title: t("howItWorks.step3.longTitle"),
      description: t("howItWorks.step3.longDesc"),
    },
    {
      number: 4,
      title: t("howItWorks.step4.title"),
      description: t("howItWorks.step4.longDesc"),
    },
  ];

  const legalItems = [
    t("howItWorks.legal.infarmed"),
    t("howItWorks.legal.compliant"),
    t("howItWorks.legal.secure"),
    t("howItWorks.legal.oversight"),
    t("howItWorks.legal.quality"),
  ];

  return (
    <div
      className="pt-20 pb-16"
      style={{
        backgroundColor: "var(--tenant-color-background, #ffffff)",
        fontFamily: "var(--tenant-font-base, inherit)",
      }}
    >
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1
            className="text-4xl md:text-5xl font-bold mb-8"
            style={{
              color: "var(--tenant-color-heading, #111827)",
              fontFamily: "var(--tenant-font-heading, inherit)",
            }}
          >
            {t("howItWorks.title")}
          </h1>
          <p
            className="text-xl max-w-2xl mx-auto"
            style={{ color: "var(--tenant-color-text-muted, #6b7280)" }}
          >
            {t("howItWorks.subtitle")} {t("howItWorks.through")}{" "}
            {tenant.businessName}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-12">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-6 items-start">
              <div className="flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{
                    backgroundColor: "var(--tenant-color-primary, #059669)",
                    color: "#ffffff",
                  }}
                >
                  {step.number}
                </div>
              </div>
              <div>
                <h3
                  className="text-2xl font-semibold mb-2"
                  style={{ color: "var(--tenant-color-heading, #111827)" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-lg"
                  style={{ color: "var(--tenant-color-text, #1f2937)" }}
                >
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-16 p-8 rounded-lg max-w-4xl mx-auto"
          style={{
            backgroundColor: "var(--tenant-color-surface, #f9fafb)",
            borderColor: "var(--tenant-color-border, #e5e7eb)",
            borderWidth: "1px",
          }}
        >
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ color: "var(--tenant-color-heading, #111827)" }}
          >
            {t("howItWorks.legal.title")}
          </h2>
          <ul className="space-y-3">
            {legalItems.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle2
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  style={{ color: "var(--tenant-color-success, #10b981)" }}
                />
                <span style={{ color: "var(--tenant-color-text, #1f2937)" }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
