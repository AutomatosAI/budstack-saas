"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  HelpCircle,
  ClipboardCheck,
  ShoppingBag,
  LayoutDashboard,
  Shield,
  Package,
  User,
  Truck,
  FileText,
  Mail,
  Phone,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const defaultFaqCategories = [
  {
    id: "eligibility",
    label: "Eligibility & Assessment",
    icon: "Shield",
    color: "hsl(152 60% 40%)",
    colorBg: "hsl(152 60% 94%)",
    questions: [
      {
        q: "Who is eligible for medical cannabis?",
        a: "Medical cannabis may be prescribed to patients with qualifying conditions who have not responded adequately to conventional treatments. Eligibility is assessed by a licensed prescriber during your consultation.",
      },
      {
        q: "What conditions qualify for treatment?",
        a: "Common qualifying conditions include chronic pain, anxiety, PTSD, epilepsy, multiple sclerosis, and chemotherapy-related symptoms. The full list varies by jurisdiction.",
      },
      {
        q: "How long does the assessment process take?",
        a: "The initial assessment typically takes 15-30 minutes. You'll receive a decision within 24-48 hours of completing your consultation.",
      },
      {
        q: "Do I need a referral from my GP?",
        a: "A GP referral is not always required, but having your medical records available can help speed up the assessment process.",
      },
    ],
  },
  {
    id: "products",
    label: "Products & Quality",
    icon: "Package",
    color: "hsl(185 60% 35%)",
    colorBg: "hsl(185 60% 94%)",
    questions: [
      {
        q: "Are your products lab tested?",
        a: "Yes, all products undergo rigorous third-party laboratory testing for potency, purity, and contaminants. Certificates of analysis are available for every batch.",
      },
      {
        q: "What forms of medical cannabis are available?",
        a: "We offer dried flower, oils, capsules, and other formulations. Your prescriber will recommend the most appropriate form for your condition.",
      },
      {
        q: "How should I store my medication?",
        a: "Store in a cool, dry place away from direct sunlight. Keep medications in their original packaging and out of reach of children.",
      },
    ],
  },
  {
    id: "account",
    label: "Account & Verification",
    icon: "User",
    color: "hsl(270 60% 50%)",
    colorBg: "hsl(270 60% 95%)",
    questions: [
      {
        q: "How do I create an account?",
        a: "You can create an account during the consultation process. You'll need to provide identification and basic medical information.",
      },
      {
        q: "What verification is required?",
        a: "We require government-issued photo ID and proof of address. Additional medical documentation may be requested during your consultation.",
      },
      {
        q: "How is my data protected?",
        a: "We use industry-standard encryption and comply with all applicable data protection regulations. Your medical information is kept strictly confidential.",
      },
    ],
  },
  {
    id: "delivery",
    label: "Delivery & Shipping",
    icon: "Truck",
    color: "hsl(38 80% 45%)",
    colorBg: "hsl(38 80% 94%)",
    questions: [
      {
        q: "How is my order delivered?",
        a: "Orders are shipped in discreet, plain packaging via tracked courier. A signature is required upon delivery.",
      },
      {
        q: "How long does delivery take?",
        a: "Standard delivery typically takes 2-5 business days. Express delivery options may be available depending on your location.",
      },
      {
        q: "Can someone else receive my delivery?",
        a: "Due to the nature of the medication, deliveries must be signed for by the named patient or an authorised representative.",
      },
    ],
  },
  {
    id: "legal",
    label: "Legal & Compliance",
    icon: "FileText",
    color: "hsl(350 70% 50%)",
    colorBg: "hsl(350 70% 95%)",
    questions: [
      {
        q: "Is medical cannabis legal?",
        a: "Medical cannabis is legal when prescribed by a licensed prescriber in jurisdictions where it is permitted. We only operate in regions where medical cannabis is legally available.",
      },
      {
        q: "Can I travel with my prescription?",
        a: "Travelling with medical cannabis varies by jurisdiction. We recommend checking local regulations and carrying your prescription documentation at all times.",
      },
      {
        q: "What happens if regulations change?",
        a: "We continuously monitor regulatory changes and will notify patients of any changes that may affect their treatment. Our compliance team ensures we always operate within current legal frameworks.",
      },
    ],
  },
];

const iconMap: Record<string, any> = {
  Shield,
  Package,
  User,
  Truck,
  FileText,
};

interface SupportContentProps {
  basePath: string;
  businessName: string;
  pageContent?: any;
}

export default function SupportContent({
  basePath,
  businessName,
  pageContent,
}: SupportContentProps) {
  const faqCategories = pageContent?.faqCategories || defaultFaqCategories;
  const contactEmail = pageContent?.contactEmail || "support@example.com";
  const contactPhone = pageContent?.contactPhone || "+44 (0) 800 000 0000";

  const quickActions = [
    {
      icon: ClipboardCheck,
      title: "Check Eligibility",
      description: "Find out if you qualify for medical cannabis treatment",
      href: `${basePath}/consultation`,
      color: "hsl(var(--tenant-color-primary))",
    },
    {
      icon: ShoppingBag,
      title: "Browse Products",
      description: "View our range of pharmaceutical-grade products",
      href: `${basePath}/products`,
      color: "hsl(var(--tenant-color-primary))",
    },
    {
      icon: LayoutDashboard,
      title: "Patient Portal",
      description: "Access your prescriptions and account details",
      href: `${basePath}/dashboard`,
      color: "hsl(var(--tenant-color-primary))",
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section
        className="py-12 md:py-16"
        style={{
          background:
            "linear-gradient(to bottom, hsl(var(--tenant-color-primary) / 0.06), transparent)",
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-3xl mx-auto text-center"
          >
            <motion.div variants={fadeInUp} className="mb-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                style={{
                  backgroundColor:
                    "hsl(var(--tenant-color-primary) / 0.1)",
                }}
              >
                <HelpCircle
                  className="w-8 h-8"
                  style={{ color: "hsl(var(--tenant-color-primary))" }}
                />
              </div>
            </motion.div>
            <motion.h1
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
              variants={fadeInUp}
            >
              How Can We Help?
            </motion.h1>
            <motion.p
              className="text-base md:text-lg max-w-2xl mx-auto"
              style={{
                color: "hsl(var(--tenant-color-text))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              variants={fadeInUp}
            >
              Find answers to common questions or get in touch with our support team.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {quickActions.map((action) => (
              <motion.div key={action.title} variants={fadeInUp}>
                <Link href={action.href}>
                  <div
                    className="group rounded-xl overflow-hidden text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border"
                    style={{
                      borderColor:
                        "hsl(var(--tenant-color-primary) / 0.12)",
                      backgroundColor:
                        "hsl(var(--tenant-color-background))",
                    }}
                  >
                    {/* Accent bar */}
                    <div
                      className="h-1.5"
                      style={{ backgroundColor: "hsl(var(--tenant-color-primary))" }}
                    />
                    <div className="p-6">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"
                        style={{
                          backgroundColor:
                            "hsl(var(--tenant-color-primary) / 0.1)",
                        }}
                      >
                        <action.icon
                          className="w-6 h-6"
                          style={{
                            color: "hsl(var(--tenant-color-primary))",
                          }}
                        />
                      </div>
                      <h3
                        className="font-semibold text-base mb-2"
                        style={{
                          color: "hsl(var(--tenant-color-heading))",
                          fontFamily:
                            "var(--tenant-font-heading, sans-serif)",
                        }}
                      >
                        {action.title}
                      </h3>
                      <p
                        className="text-sm mb-3"
                        style={{
                          color: "hsl(var(--tenant-color-text))",
                          fontFamily: "var(--tenant-font-base, sans-serif)",
                        }}
                      >
                        {action.description}
                      </p>
                      <ChevronRight
                        className="w-4 h-4 mx-auto transition-transform group-hover:translate-x-1"
                        style={{ color: "hsl(var(--tenant-color-primary))" }}
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Tabbed FAQ */}
      <section
        className="py-16 md:py-24"
        style={{
          backgroundColor: "hsl(var(--tenant-color-primary) / 0.03)",
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.h2
              className="text-2xl md:text-3xl font-semibold mb-10 tracking-tight text-center"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
              variants={fadeInUp}
            >
              Frequently Asked Questions
            </motion.h2>

            <motion.div variants={fadeInUp}>
              <Tabs
                defaultValue={faqCategories[0]?.id || "eligibility"}
                className="w-full"
              >
                <TabsList className="w-full flex-wrap h-auto gap-2 bg-transparent p-0 mb-8 justify-center">
                  {faqCategories.map(
                    (cat: {
                      id: string;
                      label: string;
                      icon: string;
                      color: string;
                      colorBg: string;
                    }) => {
                      const IconComp = iconMap[cat.icon] || Shield;
                      return (
                        <TabsTrigger
                          key={cat.id}
                          value={cat.id}
                          className="rounded-full px-4 py-2 text-sm font-medium border transition-all data-[state=active]:shadow-md data-[state=active]:text-white"
                          style={
                            {
                              "--tab-active-bg": cat.color,
                              borderColor: cat.color + "30",
                              fontFamily:
                                "var(--tenant-font-base, sans-serif)",
                            } as any
                          }
                        >
                          <IconComp className="w-4 h-4 mr-2" />
                          <span className="hidden sm:inline">
                            {cat.label}
                          </span>
                          <span className="sm:hidden">
                            {cat.label.split(" ")[0]}
                          </span>
                        </TabsTrigger>
                      );
                    }
                  )}
                </TabsList>

                {faqCategories.map(
                  (cat: {
                    id: string;
                    label: string;
                    questions: { q: string; a: string }[];
                  }) => (
                    <TabsContent key={cat.id} value={cat.id}>
                      <Accordion
                        type="single"
                        collapsible
                        className="space-y-3"
                      >
                        {cat.questions.map(
                          (faq: { q: string; a: string }, qi: number) => (
                            <AccordionItem
                              key={qi}
                              value={`${cat.id}-${qi}`}
                              className="rounded-xl border-0 overflow-hidden"
                              style={{
                                border:
                                  "1px solid hsl(var(--tenant-color-primary) / 0.1)",
                                backgroundColor:
                                  "hsl(var(--tenant-color-background))",
                              }}
                            >
                              <AccordionTrigger className="px-6 py-4 hover:no-underline text-left">
                                <div className="flex items-center gap-3">
                                  <span
                                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                    style={{
                                      backgroundColor: "hsl(var(--tenant-color-primary))",
                                    }}
                                  >
                                    {qi + 1}
                                  </span>
                                  <span
                                    className="font-medium text-sm"
                                    style={{
                                      color:
                                        "hsl(var(--tenant-color-heading))",
                                      fontFamily:
                                        "var(--tenant-font-base, sans-serif)",
                                    }}
                                  >
                                    {faq.q}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-6 pb-5">
                                <p
                                  className="text-sm leading-relaxed"
                                  style={{
                                    color:
                                      "hsl(var(--tenant-color-text))",
                                    fontFamily:
                                      "var(--tenant-font-base, sans-serif)",
                                  }}
                                >
                                  {faq.a}
                                </p>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        )}
                      </Accordion>
                    </TabsContent>
                  )
                )}
              </Tabs>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
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
              className="text-2xl md:text-3xl font-semibold mb-10 tracking-tight text-center"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
              variants={fadeInUp}
            >
              Still Need Help?
            </motion.h2>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Email Support */}
              <motion.div
                className="rounded-xl p-6 border"
                style={{
                  borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
                  backgroundColor: "hsl(var(--tenant-color-background))",
                }}
                variants={fadeInUp}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    backgroundColor:
                      "hsl(var(--tenant-color-primary) / 0.1)",
                  }}
                >
                  <Mail
                    className="w-6 h-6"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  />
                </div>
                <h3
                  className="font-semibold text-base mb-1"
                  style={{
                    color: "hsl(var(--tenant-color-heading))",
                    fontFamily: "var(--tenant-font-heading, sans-serif)",
                  }}
                >
                  Email Support
                </h3>
                <p
                  className="text-sm mb-3"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  {contactEmail}
                </p>
                <div className="flex items-center gap-1.5">
                  <Clock
                    className="w-3.5 h-3.5"
                    style={{
                      color: "hsl(var(--tenant-color-primary))",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    Response within 24 hours
                  </span>
                </div>
              </motion.div>

              {/* Phone Support */}
              <motion.div
                className="rounded-xl p-6 border"
                style={{
                  borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
                  backgroundColor: "hsl(var(--tenant-color-background))",
                }}
                variants={fadeInUp}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    backgroundColor:
                      "hsl(var(--tenant-color-primary) / 0.1)",
                  }}
                >
                  <Phone
                    className="w-6 h-6"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  />
                </div>
                <h3
                  className="font-semibold text-base mb-1"
                  style={{
                    color: "hsl(var(--tenant-color-heading))",
                    fontFamily: "var(--tenant-font-heading, sans-serif)",
                  }}
                >
                  Phone Support
                </h3>
                <p
                  className="text-sm mb-3"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  {contactPhone}
                </p>
                <div className="flex items-center gap-1.5">
                  <Clock
                    className="w-3.5 h-3.5"
                    style={{
                      color: "hsl(var(--tenant-color-primary))",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    Mon–Fri, 9am–5pm
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
