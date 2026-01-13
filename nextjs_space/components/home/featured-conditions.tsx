"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brain,
  Heart,
  Zap,
  Moon,
  Shield,
  Activity,
  ArrowRight,
  Users,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";

interface FeaturedConditionsProps {
  consultationUrl?: string;
}

export function FeaturedConditions({
  consultationUrl = "/store/healingbuds/consultation",
}: FeaturedConditionsProps = {}) {
  const { t } = useLanguage();

  const conditions = [
    {
      icon: Brain,
      name: t("conditions.chronicPain.name"),
      description: t("conditions.chronicPain.description"),
      prevalence: t("conditions.chronicPain.prevalence"),
      color: "red",
      path: "/conditions",
    },
    {
      icon: Zap,
      name: t("conditions.anxietyDepression.name"),
      description: t("conditions.anxietyDepression.description"),
      prevalence: t("conditions.anxietyDepression.prevalence"),
      color: "purple",
      path: "/conditions",
    },
    {
      icon: Activity,
      name: t("conditions.neurological.name"),
      description: t("conditions.neurological.description"),
      prevalence: t("conditions.neurological.prevalence"),
      color: "blue",
      path: "/conditions",
    },
    {
      icon: Moon,
      name: t("conditions.sleepDisorders.name"),
      description: t("conditions.sleepDisorders.description"),
      prevalence: t("conditions.sleepDisorders.prevalence"),
      color: "indigo",
      path: "/conditions",
    },
    {
      icon: Heart,
      name: t("conditions.gastrointestinal.name"),
      description: t("conditions.gastrointestinal.description"),
      prevalence: t("conditions.gastrointestinal.prevalence"),
      color: "orange",
      path: "/conditions",
    },
    {
      icon: Shield,
      name: t("conditions.cancerSupport.name"),
      description: t("conditions.cancerSupport.description"),
      prevalence: t("conditions.cancerSupport.prevalence"),
      color: "green",
      path: "/conditions",
    },
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      red: {
        bg: "bg-red-50",
        border: "border-red-200",
        icon: "bg-red-100 text-red-600",
        text: "text-red-600",
        hover: "hover:border-red-300",
      },
      purple: {
        bg: "bg-purple-50",
        border: "border-purple-200",
        icon: "bg-purple-100 text-purple-600",
        text: "text-purple-600",
        hover: "hover:border-purple-300",
      },
      blue: {
        bg: "bg-blue-50",
        border: "border-blue-200",
        icon: "bg-blue-100 text-blue-600",
        text: "text-blue-600",
        hover: "hover:border-blue-300",
      },
      indigo: {
        bg: "bg-indigo-50",
        border: "border-indigo-200",
        icon: "bg-indigo-100 text-indigo-600",
        text: "text-indigo-600",
        hover: "hover:border-indigo-300",
      },
      orange: {
        bg: "bg-orange-50",
        border: "border-orange-200",
        icon: "bg-orange-100 text-orange-600",
        text: "text-orange-600",
        hover: "hover:border-orange-300",
      },
      green: {
        bg: "bg-green-50",
        border: "border-green-200",
        icon: "bg-green-100 text-green-600",
        text: "text-green-600",
        hover: "hover:border-green-300",
      },
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.green;
  };

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-green-100 text-green-800 border-green-200">
            <Shield className="w-3 h-3 mr-1" />
            {t("trust.badge.infarmed.title")}
          </Badge>
          <h2 className="text-4xl font-bold text-gray-900 mb-6 font-serif">
            {t("conditions.section.title")}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t("conditions.section.description")}
          </p>
        </motion.div>

        {/* Conditions grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {conditions.map((condition, index) => {
            const colors = getColorClasses(condition.color);

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Link href={condition.path}>
                  <div
                    className={`condition-card ${colors.bg} ${colors.border} ${colors.hover} cursor-pointer group`}
                  >
                    <div className="flex items-start space-x-4 mb-4">
                      <div
                        className={`p-3 rounded-lg ${colors.icon} group-hover:scale-110 transition-transform duration-300`}
                      >
                        <condition.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 group-hover:text-gray-800 mb-1">
                          {condition.name}
                        </h3>
                      </div>
                    </div>

                    <p className="text-gray-700 mb-4 leading-relaxed">
                      {condition.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {condition.prevalence}
                        </span>
                      </div>
                      <ArrowRight
                        className={`w-4 h-4 ${colors.text} group-hover:translate-x-1 transition-transform`}
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Statistics and CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl p-12 text-white relative overflow-hidden"
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="grid grid-cols-8 gap-4 h-full">
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white rotate-12" />
                </div>
              ))}
            </div>
          </div>

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl font-bold font-serif">
                Comprehensive Medical Cannabis Care
              </h3>
              <p className="text-xl text-green-100">
                Our approach covers 83+ medical conditions with personalized
                treatment plans designed by Portuguese licensed healthcare
                professionals.
              </p>

              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">83+</div>
                  <div className="text-green-200 text-sm">
                    Conditions Treated
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">85%</div>
                  <div className="text-green-200 text-sm">Success Rate</div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-5 h-5 text-green-300" />
                  <span className="text-green-100">
                    Evidence-based treatment protocols
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-green-300" />
                  <span className="text-green-100">
                    INFARMED-approved prescriptions
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-green-300" />
                  <span className="text-green-100">
                    Personalized consultation approach
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-green-300" />
                  <span className="text-green-100">
                    Ongoing monitoring and support
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/conditions" className="flex-1">
                  <Button className="w-full bg-white text-green-700 hover:bg-green-50 shadow-lg hover:shadow-xl transition-all duration-300">
                    {t("conditions.viewAllConditions")}
                  </Button>
                </Link>
                <Link href={consultationUrl} className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full border-white/30 text-white hover:bg-white/10 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {t("conditions.startConsultation")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
