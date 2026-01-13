"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Stethoscope,
  Shield,
  Award,
  MapPin,
  Clock,
  Users,
  CheckCircle,
  Star,
  ArrowRight,
  Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tenant } from "@/types/client";
import { useLanguage } from "@/lib/i18n";

interface HeroSectionProps {
  tenant?: Tenant | null;
  heroImageUrl?: string | null;
  consultationUrl?: string;
}

export function HeroSection({
  tenant,
  heroImageUrl,
  consultationUrl = "/store/healingbuds/consultation",
}: HeroSectionProps = {}) {
  const { t } = useLanguage();
  const settings = (tenant?.settings as any) || {};
  const brandName = tenant?.businessName || "HealingBuds";
  const tagline = settings.tagline || t("hero.subtitle");
  const primaryColor = settings.primaryColor || "#10b981"; // green-500
  const secondaryColor = settings.secondaryColor || "#3b82f6"; // blue-500
  const accentColor = settings.accentColor || "#fbbf24"; // yellow-400

  // Get custom content from tenant settings - fallback to translations
  const heroTitle = settings.pageContent?.home?.heroTitle || t("hero.title");
  const heroSubtitle = settings.pageContent?.home?.heroSubtitle || tagline;
  const heroCtaText =
    settings.pageContent?.home?.heroCtaText || t("hero.cta.primary");

  const [stats, setStats] = useState({
    patients: 0,
    consultations: 0,
    satisfaction: 0,
    years: 0,
  });

  const finalStats = {
    patients: 2500,
    consultations: 8600,
    satisfaction: 98,
    years: 5,
  };

  useEffect(() => {
    const animateStats = () => {
      const duration = 2000; // 2 seconds
      const interval = 50; // Update every 50ms
      const steps = duration / interval;

      const increment = {
        patients: finalStats.patients / steps,
        consultations: finalStats.consultations / steps,
        satisfaction: finalStats.satisfaction / steps,
        years: finalStats.years / steps,
      };

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;

        if (currentStep <= steps) {
          setStats({
            patients: Math.floor(increment.patients * currentStep),
            consultations: Math.floor(increment.consultations * currentStep),
            satisfaction: Math.floor(increment.satisfaction * currentStep),
            years: Math.floor(increment.years * currentStep),
          });
        } else {
          setStats(finalStats);
          clearInterval(timer);
        }
      }, interval);

      return () => clearInterval(timer);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateStats();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 },
    );

    const statsElement = document.getElementById("stats-section");
    if (statsElement) {
      observer.observe(statsElement);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        // @ts-ignore
        "--primary-color": primaryColor,
        "--secondary-color": secondaryColor,
        "--accent-color": accentColor,
      }}
    >
      {/* Background */}
      <div className="absolute inset-0">
        {/* Hero Image if uploaded */}
        {heroImageUrl ? (
          <>
            <Image
              src={heroImageUrl}
              alt={`${brandName} hero`}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30 z-10" />
          </>
        ) : (
          <>
            {/* Gradient overlay */}
            <div className="absolute inset-0 hero-gradient z-10" />

            {/* Abstract medical/cannabis background pattern */}
            <div className="absolute inset-0 z-0">
              <div
                className="absolute top-20 left-10 w-32 h-32 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="absolute top-40 right-20 w-40 h-40 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
                style={{
                  backgroundColor: secondaryColor,
                  animationDelay: "1s",
                }}
              />
              <div
                className="absolute bottom-20 left-20 w-36 h-36 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
                style={{ backgroundColor: primaryColor, animationDelay: "2s" }}
              />
              <div
                className="absolute bottom-40 right-10 w-28 h-28 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
                style={{
                  backgroundColor: secondaryColor,
                  animationDelay: "1.5s",
                }}
              />

              {/* Medical icons pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="grid grid-cols-12 gap-8 h-full p-8">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-center">
                      {i % 3 === 0 ? (
                        <Stethoscope className="w-6 h-6 text-white rotate-12" />
                      ) : i % 3 === 1 ? (
                        <Leaf className="w-6 h-6 text-white -rotate-12" />
                      ) : (
                        <Shield className="w-6 h-6 text-white rotate-45" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Main content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 transition-colors">
                <Shield className="w-3 h-3 mr-1" />
                INFARMED Regulated • EU-GMP Certified
              </Badge>
            </motion.div>

            {/* Main headline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="space-y-4"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="relative" style={{ color: primaryColor }}>
                  {heroTitle}
                  <div
                    className="absolute -bottom-2 left-0 right-0 h-1 rounded-full opacity-60"
                    style={{ backgroundColor: primaryColor }}
                  />
                </span>
              </h1>
              <p
                className="text-xl sm:text-2xl font-medium"
                style={{ color: secondaryColor }}
              >
                {heroSubtitle}
              </p>
            </motion.div>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-lg text-white/90 leading-relaxed max-w-xl"
            >
              Free Online Consultations for Personalized Treatment Plans.
              Connect with licensed doctors for INFARMED-approved medical
              cannabis prescriptions.
            </motion.p>

            {/* Key benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="space-y-3"
            >
              {[
                {
                  icon: CheckCircle,
                  text: "Free consultation with licensed doctors",
                },
                { icon: Shield, text: "INFARMED-regulated prescriptions" },
                { icon: Clock, text: "24-48 hour response time" },
                { icon: MapPin, text: "Available throughout Portugal" },
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <benefit.icon
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: accentColor }}
                  />
                  <span className="text-white/90">{benefit.text}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <Link href={consultationUrl} className="inline-block">
                <button className="btn-tenant-accent shadow-xl hover:shadow-2xl transition-all duration-300 group">
                  <Stethoscope className="w-5 h-5 mr-2" />
                  {heroCtaText}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link href="/how-it-works" className="inline-block">
                <button className="btn-tenant-outline shadow-lg hover:shadow-xl transition-all duration-300">
                  {t("nav.howItWorks")}
                </button>
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="flex flex-wrap items-center gap-6 pt-4 text-sm text-white/80"
            >
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" style={{ color: accentColor }} />
                <span>EU-GMP Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: secondaryColor }} />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4" style={{ color: accentColor }} />
                <span>98% Patient Satisfaction</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right column - Stats & Visual elements */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-8"
            id="stats-section"
          >
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-6">
              <motion.div
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="text-3xl font-bold text-white mb-2 animate-count-up">
                  {stats.patients.toLocaleString()}+
                </div>
                <div className="text-white/70 text-sm">
                  {t("hero.stats.patients")}
                </div>
              </motion.div>

              <motion.div
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="text-3xl font-bold text-white mb-2 animate-count-up">
                  {stats.consultations.toLocaleString()}+
                </div>
                <div className="text-white/70 text-sm">
                  {t("hero.stats.consultations")}
                </div>
              </motion.div>

              <motion.div
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="text-3xl font-bold text-white mb-2 animate-count-up">
                  {stats.satisfaction}%
                </div>
                <div className="text-white/70 text-sm">
                  {t("hero.stats.satisfaction")}
                </div>
              </motion.div>

              <motion.div
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="text-3xl font-bold text-white mb-2 animate-count-up">
                  {stats.years}+
                </div>
                <div className="text-white/70 text-sm">
                  {t("hero.stats.yearsOfService")}
                </div>
              </motion.div>
            </div>

            {/* Featured certifications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="bg-white/5 backdrop-blur-md rounded-xl p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Our Certifications
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      INFARMED Licensed
                    </div>
                    <div className="text-white/70 text-sm">
                      Portuguese Health Authority
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      EU-GMP Certified
                    </div>
                    <div className="text-white/70 text-sm">
                      Pharmaceutical Standards
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      Licensed Doctors
                    </div>
                    <div className="text-white/70 text-sm">
                      Ordem dos Médicos Registered
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-white/60 text-center"
          >
            <div className="text-sm mb-2">Learn More</div>
            <div className="w-6 h-10 border-2 border-white/60 rounded-full mx-auto">
              <div className="w-1 h-3 bg-white/60 rounded-full mx-auto mt-2" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
