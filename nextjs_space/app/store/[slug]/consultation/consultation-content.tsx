"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle2,
  Heart,
  Brain,
  Stethoscope,
  Activity,
  HandHeart,
  ClipboardList,
  UserCheck,
  MessageSquare,
  FileCheck,
  ShoppingBag,
  Smile,
  AlertTriangle,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const specialties = [
  {
    icon: Activity,
    title: "Pain Management",
    description:
      "Chronic pain conditions that may benefit from medical cannabis therapy.",
    conditions: [
      "Chronic back pain",
      "Fibromyalgia",
      "Neuropathic pain",
      "Arthritis",
      "Complex regional pain syndrome",
      "Migraine and chronic headaches",
    ],
  },
  {
    icon: Brain,
    title: "Psychiatry",
    description:
      "Mental health conditions where medical cannabis may offer relief.",
    conditions: [
      "PTSD",
      "Anxiety disorders",
      "Treatment-resistant depression",
      "Insomnia and sleep disorders",
      "OCD",
    ],
  },
  {
    icon: Stethoscope,
    title: "Neurology",
    description:
      "Neurological conditions with evidence supporting cannabis treatment.",
    conditions: [
      "Epilepsy and seizure disorders",
      "Multiple sclerosis",
      "Parkinson's disease",
      "Tourette syndrome",
      "Chronic fatigue syndrome",
    ],
  },
  {
    icon: Heart,
    title: "Gastroenterology",
    description:
      "Digestive and gastrointestinal conditions treatable with medical cannabis.",
    conditions: [
      "Crohn's disease",
      "Ulcerative colitis",
      "Irritable bowel syndrome",
      "Chronic nausea and vomiting",
      "Appetite disorders",
    ],
  },
  {
    icon: HandHeart,
    title: "Palliative Care",
    description:
      "Symptom management for serious and terminal conditions.",
    conditions: [
      "Cancer-related symptoms",
      "Chemotherapy side effects",
      "End-of-life pain management",
      "Cachexia and wasting",
      "Quality of life improvement",
    ],
  },
];

const steps = [
  {
    icon: ClipboardList,
    title: "Fill Out Details",
    description:
      "Complete the registration form with your personal and medical information.",
  },
  {
    icon: ShieldCheck,
    title: "AML Check",
    description:
      "We verify your identity and run the required anti-money-laundering checks.",
  },
  {
    icon: ShoppingBag,
    title: "Shop",
    description:
      "Once verified, browse our catalogue and order the products you need.",
  },
  {
    icon: Smile,
    title: "Enjoy",
    description:
      "Receive your delivery and enjoy your personalised treatment.",
  },
];

interface ConsultationContentProps {
  basePath: string;
  pageContent?: any;
}

export default function ConsultationContent({
  basePath,
  pageContent,
}: ConsultationContentProps) {
  const contentSpecialties = pageContent?.specialties || specialties;
  const contentSteps = pageContent?.steps || steps;
  const heroTitle = pageContent?.heroTitle || "Medical Cannabis Consultation";
  const heroSubtitle = pageContent?.heroSubtitle || "Begin your journey towards personalised medical cannabis treatment. Our streamlined process connects you with licensed prescribers.";
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  backgroundColor:
                    "hsl(var(--tenant-color-primary) / 0.1)",
                  color: "hsl(var(--tenant-color-primary))",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                <ShieldCheck className="w-4 h-4" />
                Secure & Confidential
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

      {/* Qualifying Conditions */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.h2
              className="text-2xl md:text-3xl font-semibold mb-4 tracking-tight text-center"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
              variants={fadeInUp}
            >
              Qualifying Conditions
            </motion.h2>
            <motion.p
              className="text-base md:text-lg mb-10 text-center max-w-2xl mx-auto"
              style={{
                color: "hsl(var(--tenant-color-text))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              variants={fadeInUp}
            >
              Medical cannabis may be prescribed for a range of conditions.
              Explore the specialties below.
            </motion.p>

            <motion.div variants={fadeInUp}>
              <Accordion type="single" collapsible className="space-y-4">
                {contentSpecialties.map((specialty: any, index: number) => {
                  const iconMap: Record<string, any> = { Activity, Brain, Stethoscope, Heart, HandHeart };
                  const IconComp = typeof specialty.icon === "string"
                    ? iconMap[specialty.icon] || Activity
                    : specialty.icon;
                  return (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
                      className="rounded-xl border-0 overflow-hidden"
                      style={{
                        border:
                          "1px solid hsl(var(--tenant-color-primary) / 0.12)",
                      }}
                    >
                      <AccordionTrigger
                        className="px-6 py-5 hover:no-underline"
                        style={{
                          backgroundColor:
                            "hsl(var(--tenant-color-primary) / 0.03)",
                        }}
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor:
                                "hsl(var(--tenant-color-primary) / 0.1)",
                            }}
                          >
                            <IconComp
                              className="w-5 h-5"
                              style={{
                                color: "hsl(var(--tenant-color-primary))",
                              }}
                            />
                          </div>
                          <div>
                            <h3
                              className="font-semibold text-base"
                              style={{
                                color: "hsl(var(--tenant-color-heading))",
                                fontFamily:
                                  "var(--tenant-font-heading, sans-serif)",
                              }}
                            >
                              {specialty.title}
                            </h3>
                            <p
                              className="text-sm mt-0.5"
                              style={{
                                color: "hsl(var(--tenant-color-text))",
                                fontFamily:
                                  "var(--tenant-font-base, sans-serif)",
                              }}
                            >
                              {specialty.description}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <ul className="grid sm:grid-cols-2 gap-3 pt-2">
                          {specialty.conditions.map((condition: string, ci: number) => (
                            <li
                              key={ci}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle2
                                className="w-4 h-4 flex-shrink-0"
                                style={{
                                  color:
                                    "hsl(var(--tenant-color-primary))",
                                }}
                              />
                              <span
                                className="text-sm"
                                style={{
                                  color: "hsl(var(--tenant-color-text))",
                                  fontFamily:
                                    "var(--tenant-font-base, sans-serif)",
                                }}
                              >
                                {condition}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section
        className="py-16 md:py-24"
        style={{
          backgroundColor: "hsl(var(--tenant-color-primary) / 0.04)",
        }}
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
              className="text-2xl md:text-3xl font-semibold mb-12 tracking-tight text-center"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
              variants={fadeInUp}
            >
              How It Works
            </motion.h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {contentSteps.map((step: any, index: number) => {
                const stepIconMap: Record<string, any> = { ClipboardList, UserCheck, MessageSquare, FileCheck, ShieldCheck, ShoppingBag, Smile };
                const StepIcon = typeof step.icon === "string"
                  ? stepIconMap[step.icon] || ClipboardList
                  : step.icon;
                return (
                  <motion.div
                    key={index}
                    className="text-center"
                    variants={fadeInUp}
                  >
                    <div className="relative mb-5 w-16 h-16 mx-auto">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{
                          backgroundColor:
                            "hsl(var(--tenant-color-primary) / 0.1)",
                        }}
                      >
                        <StepIcon
                          className="w-7 h-7"
                          style={{
                            color: "hsl(var(--tenant-color-primary))",
                          }}
                        />
                      </div>
                      <span
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                        style={{
                          backgroundColor:
                            "hsl(var(--tenant-color-primary))",
                        }}
                      >
                        {index + 1}
                      </span>
                    </div>
                    <h3
                      className="font-semibold text-base mb-2"
                      style={{
                        color: "hsl(var(--tenant-color-heading))",
                        fontFamily:
                          "var(--tenant-font-heading, sans-serif)",
                      }}
                    >
                      {step.title}
                    </h3>
                    {step.highlight && (
                      <span
                        className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold mb-2"
                        style={{
                          backgroundColor: "hsl(var(--tenant-color-primary) / 0.1)",
                          color: "hsl(var(--tenant-color-primary))",
                          fontFamily: "var(--tenant-font-base, sans-serif)",
                        }}
                      >
                        {step.highlight}
                      </span>
                    )}
                    <p
                      className="text-sm leading-relaxed"
                      style={{
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      {step.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Compliance Notice */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="max-w-4xl mx-auto rounded-xl p-6 flex items-start gap-4"
            style={{
              backgroundColor: "hsl(38 92% 95%)",
              border: "1px solid hsl(38 92% 80%)",
            }}
          >
            <AlertTriangle
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: "hsl(38 92% 40%)" }}
            />
            <div>
              <p
                className="text-sm font-medium mb-1"
                style={{
                  color: "hsl(38 60% 30%)",
                  fontFamily: "var(--tenant-font-heading, sans-serif)",
                }}
              >
                Important Notice
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{
                  color: "hsl(38 40% 35%)",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                Medical cannabis is a prescription medication. This
                consultation does not guarantee a prescription. All
                applications are reviewed by licensed medical professionals
                who will determine eligibility based on your medical history
                and applicable regulations.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
