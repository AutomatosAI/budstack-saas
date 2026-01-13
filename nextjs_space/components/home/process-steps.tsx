"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  UserPlus,
  Stethoscope,
  FileText,
  MapPin,
  Clock,
  Shield,
  CheckCircle,
  ArrowRight,
  Calendar,
  Pill,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProcessStepsProps {
  consultationUrl?: string;
}

export function ProcessSteps({
  consultationUrl = "/store/healingbuds/consultation",
}: ProcessStepsProps = {}) {
  const steps = [
    {
      step: 1,
      title: "Registration & KYC",
      subtitle: "Quick Identity Verification",
      description:
        "Create your secure account and verify your Portuguese identity with Cartão de Cidadão. Complete medical history form.",
      icon: UserPlus,
      duration: "5-10 minutes",
      features: [
        "Secure identity verification",
        "Medical history assessment",
        "Privacy protection (GDPR)",
        "Portuguese ID integration",
      ],
      color: "blue",
    },
    {
      step: 2,
      title: "Free Medical Consultation",
      subtitle: "Licensed Doctor Review",
      description:
        "Connect with INFARMED-approved doctors for personalized medical cannabis evaluation and prescription.",
      icon: Stethoscope,
      duration: "24-48 hours",
      features: [
        "Licensed Portuguese doctors",
        "Personalized treatment plans",
        "INFARMED prescription",
        "Follow-up consultations",
      ],
      color: "green",
    },
  ];

  const futurePhase = {
    title: "Phase 2: Pharmacy Integration",
    subtitle: "Coming Soon",
    description:
      "Direct pharmacy partnerships for convenient prescription fulfillment and delivery throughout Portugal.",
    icon: MapPin,
    features: [
      "Licensed pharmacy network",
      "Home delivery options",
      "Insurance integration",
      "Prescription tracking",
    ],
  };

  const getStepColors = (color: string) => {
    const colorMap = {
      blue: {
        bg: "bg-blue-50",
        border: "border-blue-200",
        icon: "bg-blue-600 text-white",
        accent: "text-blue-600",
      },
      green: {
        bg: "bg-green-50",
        border: "border-green-200",
        icon: "bg-green-600 text-white",
        accent: "text-green-600",
      },
    };
    return colorMap[color as keyof typeof colorMap];
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
            <Clock className="w-3 h-3 mr-1" />
            Simple 2-Step Process
          </Badge>
          <h2 className="text-4xl font-bold text-gray-900 mb-6 font-serif">
            How HealingBuds Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Start your medical cannabis journey in Portugal with our
            streamlined, INFARMED-compliant consultation process designed for
            your convenience.
          </p>
        </motion.div>

        {/* Process steps */}
        <div className="space-y-12 mb-16">
          {steps.map((step, index) => {
            const colors = getStepColors(step.color);

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                className="relative"
              >
                <div
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                    index % 2 === 1 ? "lg:grid-flow-col-dense" : ""
                  }`}
                >
                  {/* Content */}
                  <div
                    className={`space-y-6 ${index % 2 === 1 ? "lg:col-start-2" : ""}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center ${colors.icon}`}
                      >
                        <step.icon className="w-8 h-8" />
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className={`mb-2 ${colors.accent} border-current`}
                        >
                          Step {step.step}
                        </Badge>
                        <h3 className="text-2xl font-bold text-gray-900 font-serif">
                          {step.title}
                        </h3>
                        <p className={`text-lg font-medium ${colors.accent}`}>
                          {step.subtitle}
                        </p>
                      </div>
                    </div>

                    <p className="text-gray-600 text-lg leading-relaxed">
                      {step.description}
                    </p>

                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600 font-medium">
                          {step.duration}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700 font-medium">
                          INFARMED Compliant
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {step.features.map((feature, featureIndex) => (
                        <div
                          key={featureIndex}
                          className="flex items-center space-x-2"
                        >
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {index === 0 && (
                      <Link href="/auth/signup">
                        <Button className="medical-gradient text-white shadow-lg hover:shadow-xl transition-all duration-300 group">
                          Start Registration
                          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    )}

                    {index === 1 && (
                      <Link href={consultationUrl}>
                        <Button className="medical-gradient text-white shadow-lg hover:shadow-xl transition-all duration-300 group">
                          Book Consultation
                          <Calendar className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    )}
                  </div>

                  {/* Visual */}
                  <div className={`${index % 2 === 1 ? "lg:col-start-1" : ""}`}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className={`relative p-8 rounded-2xl ${colors.bg} ${colors.border} border-2`}
                    >
                      {/* Step number */}
                      <div className="absolute -top-4 -left-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border-4 border-gray-100">
                        <span className="text-xl font-bold text-gray-800">
                          {step.step}
                        </span>
                      </div>

                      {/* Visual content */}
                      <div className="text-center space-y-6">
                        <div
                          className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center ${colors.icon}`}
                        >
                          <step.icon className="w-12 h-12" />
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {step.title}
                          </h4>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="font-semibold text-gray-900">
                                Duration
                              </div>
                              <div className="text-gray-600">
                                {step.duration}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="font-semibold text-gray-900">
                                Status
                              </div>
                              <div className="text-green-600 font-medium">
                                Available
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Connection arrow */}
                      {index < steps.length - 1 && (
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 hidden lg:block">
                          <div className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border-4 border-gray-100">
                            <ArrowRight className="w-6 h-6 text-gray-600 rotate-90" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Future Phase 2 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative mt-20"
        >
          <div className="bg-gradient-to-r from-gray-50 to-green-50 rounded-2xl p-8 border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              <div className="space-y-4">
                <Badge
                  variant="outline"
                  className="text-orange-600 border-orange-300"
                >
                  Coming Soon
                </Badge>
                <h3 className="text-2xl font-bold text-gray-900 font-serif">
                  {futurePhase.title}
                </h3>
                <p className="text-gray-600">{futurePhase.description}</p>
              </div>

              <div className="space-y-3">
                {futurePhase.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Pill className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <div className="w-20 h-20 bg-orange-100 rounded-full mx-auto flex items-center justify-center mb-4">
                  <futurePhase.icon className="w-10 h-10 text-orange-600" />
                </div>
                <Link href="/contact">
                  <Button
                    variant="outline"
                    className="border-orange-200 text-orange-700 hover:bg-orange-50"
                  >
                    Get Notified
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center mt-16"
        >
          <div className="bg-green-800 rounded-2xl p-12 text-white relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-20 h-20 border-2 border-white rounded-full" />
              <div className="absolute bottom-4 right-4 w-16 h-16 border-2 border-white rounded-full" />
              <div className="absolute top-1/2 left-1/4 w-12 h-12 border-2 border-white rounded-full" />
            </div>

            <div className="relative space-y-6">
              <h3 className="text-3xl font-bold font-serif">
                Ready to Start Your Medical Cannabis Journey?
              </h3>
              <p className="text-xl text-green-100 max-w-2xl mx-auto">
                Join thousands of Portuguese patients who have found relief
                through our INFARMED-approved medical cannabis consultation
                service.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/signup">
                  <Button
                    size="lg"
                    className="bg-white text-green-800 hover:bg-green-50 shadow-xl hover:shadow-2xl transition-all duration-300 group"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Start Free Registration
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/30 text-white hover:bg-white/10 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Learn More
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
